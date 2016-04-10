// Sample event data
module.exports = {
  "id": "ee376907-2647-4179-9203-343cfb3017a4",
  "detail-type": "EC2 Instance State-change Notification",
  "source": "aws.ec2",
  "account": "123456789012",
  "time": "2015-11-11T21:30:34Z",
  "region": "us-east-1",
  "resources": [
    "arn:aws:ec2:us-east-1:123456789012:instance/i-627c6bdc"
  ],
  "detail": {
    "instance-id": "i-627c6bdc",
    "state": "running"
  }
};
