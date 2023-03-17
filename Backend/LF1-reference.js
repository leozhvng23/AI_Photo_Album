console.log("Loading function");

import * as aws from "@aws-sdk/client-s3";

const s3 = new aws.S3({ apiVersion: "2006-03-01" });

const handler = async (event, context) => {
  //console.log('Received event:', JSON.stringify(event, null, 2));

  // Get the object from the event and show its content type
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  const params = {
    Bucket: bucket,
    Key: key,
  };
  try {
    const { ContentType } = await s3.getObject(params);
    console.log("CONTENT TYPE:", ContentType);
    return ContentType;
  } catch (err) {
    console.log(err);
    const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
    throw new Error(message);
  }
};

export { handler };
