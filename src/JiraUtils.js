/**
 * Simple delay helper
 * @param {number} ms
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const createHeaders = (username, token) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString(
    "base64"
  )}`,
});

/**
 * Fetch changelog for a Jira issue (with retry & delay)
 * @param {string} issueKey
 * @param {string} apiUrl
 * @param {string} username
 * @param {string} token
 * @returns {Promise<Array>}
 */
export async function fetchIssueChangelog(
  issueKey,
  { apiUrl, username, token }
) {
  const randomDelay = 200 + Math.floor(Math.random() * 600);
  await delay(randomDelay);

  const url = `${apiUrl}/issue/${issueKey}/changelog`;

  const headers = createHeaders(username, token);

  try {
    const response = await fetch(url, { headers });

    if (response.status === 429) {
      console.warn(
        `WARN: Rate limited for ${issueKey}, waiting 3 s before retry…`
      );
      await delay(3000);
      const retry = await fetch(url, {
        headers: createHeaders(username, token),
      });
      if (!retry.ok) {
        console.warn(`WARN: Retry failed for ${issueKey} (${retry.status})`);
        return [];
      }
      const j = await retry.json();
      return Array.isArray(j.values) ? j.values : [];
    }

    if (!response.ok) {
      console.warn(
        `WARN: Fetch failed for ${issueKey}: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const json = await response.json();
    return Array.isArray(json.values) ? json.values : [];
  } catch (err) {
    console.warn(
      `WARN: Error fetching changelog for ${issueKey}: ${err.message}`
    );
    return [];
  }
}

/**
 * Fetch all issue keys matching a JQL query, with pagination
 * using the GET /rest/api/3/search/jql endpoint
 */
export async function fetchIssueKeys(
  jql,
  { apiUrl, username, token },
  batchSize = 5000
) {
  let startAt = 0;
  let total = null;

  const headers = createHeaders(username, token);

  console.log(`Fetching issue keys for JQL: "${jql}"`);

  const allKeys = [];
  try {
    do {
      const q = new URLSearchParams({
        jql,
        startAt: String(startAt),
        maxResults: String(batchSize),
        fields: "key",
      });

      const url = `${apiUrl}/search/jql?${q.toString()}`;
      console.debug(`🔍 Requesting: ${url}`);

      const response = await fetch(url, { method: "GET", headers });

      if (response.status === 429) {
        console.warn(`WARN: Rate-limit hit, waiting 3 s before retry…`);
        await delay(3000);
        continue;
      }

      if (!response.ok) {
        const body = await response
          .clone()
          .text()
          .catch(() => "");
        console.error(
          `❌ Failed to fetch issue keys: ${response.status} ${response.statusText}`
        );
        console.error(`Body: ${body.slice(0, 800)}`);
        break;
      }

      const result = await response.json();
      const issues = result.issues || [];
      const keys = issues.map((i) => i.key);
      allKeys.push(...keys);

      total = result.total ?? issues.length;
      startAt += issues.length;

      console.debug(
        `Fetched ${keys.length} issue keys (total so far: ${allKeys.length}/${
          total ?? "?"
        })`
      );

      await delay(200 + Math.random() * 500);
    } while (total === null || startAt < total);
  } catch (err) {
    console.error(`❌ Exception during fetchIssueKeys: ${err.message}`);
  }

  console.log(`✅ Done. Retrieved ${allKeys.length} issues from Jira.`);
  return allKeys;
}
