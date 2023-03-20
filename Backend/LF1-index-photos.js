// Reference documentation:
// https://docs.aws.amazon.com/rekognition/latest/dg/labels-detect-labels-image.html
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rekognition/classes/detectlabelscommand.html
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/headobjectcommand.html
// https://docs.aws.amazon.com/opensearch-service/latest/developerguide/indexing.html
// https://opensearch.org/docs/2.6/clients/javascript/index/

import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";

const REGION = "us-east-1";
const s3Client = new S3Client({ region: REGION });
const rekognitionClient = new RekognitionClient({ region: REGION });
const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: REGION,
    service: "es",
    getCredentials: () => {
      const credentialsProvider = defaultProvider();
      return credentialsProvider();
    },
  }),
  node: "https://search-photos-mxuc7wztqoqaofdypn2ua7t5le.us-east-1.es.amazonaws.com",
});

/**
 * Detects labels in an image using Amazon Rekognition.
 *
 * @param {string} bucket - The S3 bucket containing the image
 * @param {string} key - The object key of the image in the S3 bucket.
 * @returns {Promise<string[]>} A promise that resolves to an array of detected labels.
 */
const detectLabelsFromImage = async (bucket, key) => {
  const params = {
    Image: {
      S3Object: {
        Bucket: bucket,
        Name: key,
      },
    },
    MaxLabels: 10,
  };

  const command = new DetectLabelsCommand(params);
  const response = await rekognitionClient.send(command);
  const labels = response.Labels.map((label) =>
    // lower case and remove spaces
    label.Name.toLowerCase().replace(" ", "")
  );
  console.log("Labels: ", labels);
  return labels;
};

/**
 * Retrieves the metadata of an object in an S3 bucket.
 *
 * @param {string} bucket - The S3 bucket containing the object.
 * @param {string} key - The object key in the S3 bucket.
 * @returns {Promise<Object>} A promise that resolves to the metadata of the object.
 */
const getMetadata = async (bucket, key) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  const command = new HeadObjectCommand(params);
  const response = await s3Client.send(command);
  console.log("Metadata: ", response.Metadata);
  return response.Metadata;
};

/**
 * Indexes a document in an OpenSearch index.
 *
 * @param {string} objectKey - The object key of the image in the S3 bucket.
 * @param {string} bucket - The S3 bucket containing the image.
 * @param {string} createdTimestamp - The timestamp when the S3 object was created.
 * @param {string[]} labels - The array of labels associated with the image.
 * @returns {Promise<void>} A promise that resolves when the document is indexed.
 */
const indexDocument = async (objectKey, bucket, createdTimestamp, labels) => {
  const document = {
    objectKey,
    bucket,
    createdTimestamp,
    labels,
  };

  const indexName = "photos";
  const documentId = encodeURIComponent(objectKey);

  try {
    await opensearchClient.index({
      index: indexName,
      id: documentId,
      body: document,
      refresh: true,
    });
  } catch (error) {
    console.error("Failed to index document:", error);
    console.error("Error response:", error.meta.body); // Log the error response
    throw new Error(`Failed to index document: ${error.message}`);
  }
};

const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const objectKey = record.s3.object.key;

  const labelsFromRekognition = await detectLabelsFromImage(bucket, objectKey);
  const metadata = await getMetadata(bucket, objectKey);
  const customLabels = metadata["customlabels"]
    ? metadata["customlabels"]
        .split(",")
        .map((label) => label.toLowerCase().replace(" ", ""))
    : [];
  const allLabels = [...labelsFromRekognition, ...customLabels];

  const createdTimestamp = record.eventTime;
  await indexDocument(objectKey, bucket, createdTimestamp, allLabels);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify({
      message: "Successfully indexed document.",
    }),
  };
};

export { handler };

// GET /photos/_search
// {
//   "query": {
//     "match_all": {}
//   },
//   "size": 100,
//   "_source": ["objectKey", "bucket", "createdTimestamp", "labels"]
// }
