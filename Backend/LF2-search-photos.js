// Reference Documentation:
// https://opensearch.org/docs/2.6/clients/javascript/index/
// https://docs.aws.amazon.com/lexv2/latest/dg/lambda.html
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-lex-runtime-service/classes/posttextcommand.html
// https://docs.aws.amazon.com/lexv2/latest/APIReference/API_runtime_RecognizeText.html

import { LexRuntimeV2 } from "@aws-sdk/client-lex-runtime-v2";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import pluralize from "pluralize";

const REGION = "us-east-1";
const lexClient = new LexRuntimeV2({ region: REGION });
const s3Client = new S3Client({ region: REGION });
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

const customWords = ["pants", "metropolis", "noodles"];

/**
 * Retrieves keywords from a Lex bot based on the given search query.
 * @param {string} searchQuery - The search query to send to the Lex bot.
 * @returns {Promise<string[]>} A promise that resolves to an array of keywords retrieved from the Lex bot.
 */
const getKeywordsFromLex = async (searchQuery) => {
  if (!searchQuery) {
    throw new Error("Search query not provided");
  }

  const params = {
    botId: "BVMUUWPFRU",
    botAliasId: "DNTRSKGKUZ",
    localeId: "en_US",
    sessionId: "search-session",
    text: searchQuery,
  };

  const response = await lexClient.recognizeText(params);
  const slots = response.sessionState.intent.slots;
  const keywords = [];
  for (const slot in slots) {
    if (slots[slot]) {
      const slotValue = slots[slot].value.interpretedValue;
      keywords.push(slotValue);
    }
  }
  console.log("Keywords:", keywords);
  return keywords;
};

/**
 * Cleans up the provided keywords by applying various modifications such as
 * replacing unwanted words, trimming spaces, grouping words, lowercasing, and singularizing.
 * @param {string[]} keywords - An array of keywords to clean up.
 * @returns {string[]} An array of cleaned up keywords.
 */
const cleanUpKeywords = (keywords) => {
  // Replace unwanted words with commas, then split by commas, and trim spaces
  keywords = keywords.flatMap((keyword) =>
    keyword
      .replace(/(?: and | in | the | a )/gi, ",")
      .split(",")
      .map((part) => part.trim())
  );
  // Filter out empty strings
  keywords = keywords.filter((keyword) => keyword);
  // Group words like "living room" into "livingroom"
  keywords = keywords.map((keyword) => keyword.replace(/\s+/g, ""));
  // lowercase all keywords
  keywords = keywords.map((keyword) => keyword.toLowerCase());
  // singularize plural keywords
  keywords = keywords.map((keyword) => pluralize.singular(keyword));
  return keywords;
};

const generatePresignedUrl = async (bucket, objectKey) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // URL expiry time in seconds
  });

  return url;
};

/**
 * Searches for photos in an OpenSearch index based on the provided keywords.
 * @param {string[]} keywords - An array of keywords to search for.
 * @returns {Promise<object[]>} A promise that resolves to an array of photo objects that match the query.
 */
const searchPhotos = async (keywords) => {
  keywords = cleanUpKeywords(keywords);
  console.log("Cleaned up keywords:", keywords);

  const body = {
    query: {
      bool: {
        must: keywords.map((keyword) => ({
          match: {
            labels: {
              query: keyword,
              boost: 1.0,
            },
          },
        })),
      },
    },
    size: 100,
    _source: ["objectKey", "bucket", "createdTimestamp", "labels"],
  };

  const results = await opensearchClient.search({
    index: "photos",
    body: body,
  });
  const hitsArray = results.body.hits.hits;
  if (hitsArray && hitsArray.length > 0) {
    console.log("Found", hitsArray.length, "results for the given query.");
    const photos = await Promise.all(
      hitsArray.map(async (hit) => {
        const photo = hit._source;
        photo.url = await generatePresignedUrl(photo.bucket, photo.objectKey);
        return photo;
      })
    );
    return photos;
  } else {
    console.log("No results found for the given query.");
    return [];
  }
};

/**
 * Adds custom singular rules for pluralize package using the customWords array.
 */
const customSingulars = () =>
  customWords.forEach((word) => {
    pluralize.addSingularRule(word, word);
  });

/**
 * AWS Lambda function handler.
 * @param {object} event - The Lambda event object.
 * @returns {Promise<object>} A promise that resolves to an object containing the HTTP status code and response body.
 */
const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  const searchQuery = event.q;
  customSingulars();

  try {
    const keywords = await getKeywordsFromLex(searchQuery);
    const searchResults = await searchPhotos(keywords);
    if (keywords.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify([]),
      };
    }
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(
        searchResults.map(({ url, createdTimestamp, labels }) => ({
          url,
          createdTimestamp,
          labels,
        }))
      ),
    };
  } catch (error) {
    console.error("Error processing the event:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

export { handler };
