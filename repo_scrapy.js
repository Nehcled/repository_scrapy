
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import repoIssuesFilter from './repoIssuesFilter.js';

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



let get_top_100_of_mostStar_in_topic = async (topic) => {
	const fileName = `repo_scrapy_data/${topic}_mostStar.json`;

	if (fs.existsSync(`./${fileName}`)) {
		console.log(`${topic}_mostStar data exist.`);
		return JSON.parse(fs.readFileSync(`./${fileName}`, 'utf-8')).items;
	}

	const res = await octokit.rest.search.repos({
		q: `topic:${topic}`,
		sort: '',
		per_page: 100
	});

	const absFileName = path.join(__dirname, fileName);
	fs.mkdirSync('repo_scrapy_data', { recursive: true });
	fs.writeFileSync(absFileName, JSON.stringify(res.data, null, 2));

	console.log("mostStar repo data load sucessfal.");

	return res.items;
}

(async () => {
	fs.mkdirSync('repo_scrapy_data', { recursive: true });

	const mostStarRepo = await get_top_100_of_mostStar_in_topic("javascript");
	console.log(mostStarRepo);
	for(const repo of mostStarRepo){
		console.log("Repostory:", repo.name);
		await repoIssuesFilter(repo.owner.login, repo.name, 100);
		console.log();
	}

})();



