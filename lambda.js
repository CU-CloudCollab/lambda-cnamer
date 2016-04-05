var config = {
    region: 'us-east-1',
    dynamoTableName: 'team2-updatecname'
};

var AWS = require('aws-sdk');
AWS.config.region = config.region;

var ec2 = new AWS.EC2();
var route53 = new AWS.Route53();
var dynamodb = new AWS.DynamoDB();

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

function getHostedZoneIdForFQDN(cname, callback)
{
    route53.listHostedZones({}, function(err, data) {
        // FIXME: no error handling
        if (!err) {
            console.log(data);
            // FIXME: assumes single hosted zone
            for (var i=0; i < data.HostedZones.length; i++) {
                var hostedZone = data.HostedZones[i];
                
                var zoneName = hostedZone.Name;
                var zoneId = hostedZone.Id;

                if (cname.endsWith(zoneName)) {
                    return callback(zoneId);
                } 
            }
            console.log('did not find zone');
        }
    });
}

function getCnameForInstanceId(instanceId, callback)
{
    var params = {
        Key: {
            "instanceId": {"S": instanceId},
        },
        TableName: config.dynamoTableName,
        AttributesToGet: [
            'cname'
        ]
    };
    dynamodb.getItem(params, function(err, data) {
      if (err) {
          console.log(err, err.stack); // an error occurred
      } else {
        var cname = data.Item.cname.S;
        console.log('got cname back from dynamodb: ' + cname);
        return callback(cname);
      }
    });
}

exports.handler = function(event, context) {

    var params = {
        DryRun: false,
        InstanceIds: [event.detail['instance-id']]
    };

    ec2.describeInstances(params, function(err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
        } else {    
            var pubDnsName = data.Reservations[0].Instances[0].PublicDnsName;
            console.log("Instance new public dns: " + pubDnsName);
            var instanceId = data.Reservations[0].Instances[0].InstanceId;

            var cnameTag = getCnameForInstanceId(instanceId, function (cname) {
                
                console.log("Target new CNAME" + cname);
                
                var hostedZoneId = getHostedZoneIdForFQDN(cname, function (hostedZoneId) {
                        
                    var params53 = {
                        ChangeBatch: {
                        Changes: [
                          {
                            Action: 'UPSERT',
                            ResourceRecordSet: {
                              Name: cname,
                              Type: 'CNAME',
                              ResourceRecords: [
                                {
                                  Value: pubDnsName,
                                },
                              ],
                              TTL: 60,
                            }
                          }
                        ]
                      },
                      HostedZoneId: hostedZoneId
                    };
                    
                    route53.changeResourceRecordSets(params53, function(err, data) {
                        if (err) {
                            console.log(err, err.stack); // an error occurred
                            context.fail(err);
                        } else {
                            console.log(data);           // successful response
                            context.succeed(data);
                        }
                    });
                    
                });
            });
            
        }
    });
};
