// Reference Documentation:
// https://opensearch.org/docs/2.6/clients/javascript/index/
// https://docs.aws.amazon.com/lexv2/latest/dg/lambda.html
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-lex-runtime-service/classes/posttextcommand.html
// https://docs.aws.amazon.com/lexv2/latest/APIReference/API_runtime_RecognizeText.html

import { LexRuntimeV2 } from "@aws-sdk/client-lex-runtime-v2";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import pluralize from "pluralize";

const REGION = "us-east-1";
const lexClient = new LexRuntimeV2({ region: REGION });
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
const customWords = ["pants", "metropolis"];

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
  console.log("Lex response:", response);
  const slots = response.sessionState.intent.slots;
  console.log("Slots:", slots);
  const keywords = Object.values(slots)
    .filter((slot) => slot) // Filter out null slots
    .map((slot) => slot.value.interpretedValue);
  console.log("Keywords:", keywords);
  return keywords;
};

/**
 * Searches for photos in an OpenSearch index based on the provided keywords
 * @param {string[]} keywords - An array of keywords to search for
 * @returns {Promise<object[]>} A promise that resolves to an array of photo objects that match the query
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
    console.log("Found results for the given query.", hitsArray);
    return hitsArray.map((hit) => hit._source);
  } else {
    console.log("No results found for the given query.");
    return [];
  }
};

/**
 * Cleans up the provided keywords by adding singular form of keywords ending with "s"
 * and lowercasing all keywords
 * @param {string[]} keywords - An array of keywords to clean up
 * @returns {string[]} An array of cleaned up keywords
 */
const cleanUpKeywords = (keywords) => {
  // lowercase all keywords
  keywords = keywords.map((keyword) => keyword.toLowerCase());
  // singularize plural keywords
  keywords = keywords.map((keyword) => pluralize.singular(keyword));
  return keywords;
};

const customSingulars = () =>
  customWords.forEach((word) => {
    pluralize.addSingularRule(word, word);
  });

const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  const searchQuery = event.q;
  customSingulars();

  try {
    const keywords = await getKeywordsFromLex(searchQuery);
    const searchResults = await searchPhotos(keywords);
    return {
      statusCode: 200,
      body: JSON.stringify(searchResults),
    };
  } catch (error) {
    console.error("Error processing the event:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

export { handler };
