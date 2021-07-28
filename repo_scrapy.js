
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

//Reference by https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-when-using-the-experimental-modules-flag
const __dirname = dirname(fileURLToPath(import.meta.url));

// const topic = "javascript";
// const sortBy = "starts";

const octokit = new Octokit({
	auth: process.env.ACCESS_TOKEN,
	userAgent: 'myApp v18.6.2',
	previews: ['mokingbird'],
	timeZone: 'Asia/Taipei',
	baseUrl: 'https://api.github.com',
	log: {
		debug: () => { },
		info: () => { },
		warn: console.warn,
		error: console.error
	},
	request: {
		agent: undefined,
		fetch: undefined,
		timeout: 0
	}
});


(async () => {
	// const res = await octokit.rest.issues.listEventsForTimeline('/repos/{owner}/{repo}/issues/{issue_number}/timeline', {
	//   owner: owner,
	//   repo: repo,
	//   issue_number: issue.number,
	//   mediaType: {
	//     previews: [
	//       'mockingbird'
	//     ]
	//   }
	// });
	const res = await octokit.rest.search.repos({
		q: 'topic:javascript',
		sort: '',
		per_page: 100
	});

	fs.mkdirSync('repo_scrapy_data', { recursive: true });
	const dumpFileName = path.join(__dirname, 'repo_scrapy_data/javascript_mostStar.json');
	fs.writeFileSync(dumpFileName, JSON.stringify(res.data, null, 2));

	// console.log(JSON.stringify(res,null,2));

	// reposFilter();

})();



