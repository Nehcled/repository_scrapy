import { Octokit } from '@octokit/rest';

import dotenv from 'dotenv';
dotenv.config();


// console.log(process.env);

const octokit = new Octokit({
	auth: process.env.ACCESS_TOKEN || "",
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
	const core = await octokit.request('/rate_limit');
	console.log(core.data);
	console.log("API search  reset will in GMT+8 : " + new Date(await core.data.resources.search.reset * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
})();