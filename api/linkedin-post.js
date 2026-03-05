// Vidhai — LinkedIn Post API (Vercel Serverless Function)
// Posts to personal LinkedIn profile using the REST API

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN || 'urn:li:person:i9f2lLZITg';
  const orgUrn = process.env.LINKEDIN_ORG_URN || 'urn:li:organization:105592688';

  if (!accessToken) {
    return res.status(500).json({ error: 'LinkedIn access token not configured' });
  }

  try {
    const { message, postToPersonal, postToCompany } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const results = { personal: null, company: null };

    // Post to personal profile
    if (postToPersonal) {
      const personalResult = await postToLinkedIn(accessToken, personUrn, message, 'PUBLIC');
      results.personal = personalResult;
    }

    // Post to company page (requires w_organization_social scope)
    if (postToCompany) {
      const companyResult = await postToLinkedIn(accessToken, orgUrn, message, 'PUBLIC');
      results.company = companyResult;
    }

    // Check if at least one succeeded
    const personalOk = !postToPersonal || (results.personal && results.personal.success);
    const companyOk = !postToCompany || (results.company && results.company.success);

    if (personalOk || companyOk) {
      return res.status(200).json({
        success: true,
        results: results,
        message: buildSuccessMessage(results, postToPersonal, postToCompany)
      });
    } else {
      return res.status(400).json({
        success: false,
        results: results,
        message: 'Failed to post to LinkedIn. Please try again.'
      });
    }

  } catch (err) {
    console.error('LinkedIn post error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

async function postToLinkedIn(accessToken, authorUrn, commentary, visibility) {
  try {
    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202602',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary: commentary,
        visibility: visibility,
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    });

    if (response.status === 201) {
      const postId = response.headers.get('x-restli-id') || 'unknown';
      return { success: true, postId: postId };
    } else {
      const errorBody = await response.text();
      let errorMsg = 'Unknown error';
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.message || errorBody;
      } catch (e) {
        errorMsg = errorBody;
      }
      return { success: false, error: errorMsg, status: response.status };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function buildSuccessMessage(results, postToPersonal, postToCompany) {
  const parts = [];
  if (postToPersonal && results.personal && results.personal.success) {
    parts.push('personal profile');
  }
  if (postToCompany && results.company && results.company.success) {
    parts.push('Vidhai company page');
  }

  if (parts.length > 0) {
    return 'Posted to ' + parts.join(' and ') + '!';
  }

  // Partial failure messaging
  if (postToCompany && results.company && !results.company.success) {
    if (postToPersonal && results.personal && results.personal.success) {
      return 'Posted to personal profile! Company page posting requires additional LinkedIn permissions — contact your AI assistant to set this up.';
    }
  }

  return 'Post submitted.';
}
