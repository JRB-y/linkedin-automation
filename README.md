# run setupAuth.js to get the access token and person id
node src/setupAuth.js

# run a workflow
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation
# watch a workflow run
gh run watch --repo JRB-y/linkedin-automation
# set secrets
gh secret set LINKEDIN_PERSON_ID --repo JRB-y/linkedin-automation