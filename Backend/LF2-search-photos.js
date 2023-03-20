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
const customWords = ["pants", "metropolis", "noodles"];

const getKeywordsFromLex = async (searchQuery) => {
  if (!searchQuery) {
    throw new Error("Search query not provided");
  }

  const params = {
    botId: "BVMUUWPFRU",
    botAliasId: "TSTALIASID",
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
    console.log("Found", hitsArray.length, "results for the given query.");
    return hitsArray.map((hit) => hit._source);
  } else {
    console.log("No results found for the given query.");
    return [];
  }
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
    if (keywords.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify([]),
      };
    }
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
