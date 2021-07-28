import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { sleep } from './util_function.js';
dotenv.config();

//Reference by https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-when-using-the-experimental-modules-flag
const __dirname = dirname(fileURLToPath(import.meta.url));

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

let checkRateState = async () => {
	const core = await octokit.request('/rate_limit');
	if (await core.data.rate.remaining == 0) {
		console.log("API rate limit exceeded! reset will in GMT+8 : " + new Date(await core.data.rate.reset * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
		await sleep(await core.data.rate.reset * 1000 - Date.now() + 1000);
	}
}


let Promise_allBatched = (() => {
	let Promise_allBatched = async (arr, batchSize = 10) => {
		if (!arr.length) return Promise.resolve([]);

		let results = [];
		return _runBatch(arr, batchSize, results, 0);
	}

	let _runBatch = async (arr, batchSize, results, start = 0) => {
		let end = Math.min(arr.length, start + batchSize);
		let requestFailLimit = 5;

		while (end <= arr.length) {
			let requests = new Array(end - start).fill(null).map(async (item, index) => {
				let id = start + index;
				let requestFunc = arr[id];
				let request;

				if (requestFunc instanceof Function) {
					try {
						request = await requestFunc();
						return {
							id: id,
							status: "sucess",
							date: Date.now(),
							result: request
						}
					} catch (e) {
						return {
							id: id,
							status: "fail",
							errorMessage: e,
							requestFunction: requestFunc
						}
					}
				} else {
					return {
						id: id,
						status: "fail",
						errorMessage: "request doesn't exist.(not function)"
					}
				}
			});

			let res = await Promise.all(requests);

			while (requestFailLimit) {
				let batchFailLimit = batchSize;
				for (let resChecker = 0; resChecker < res.length; resChecker++) {
					// console.log(res[resChecker]);
					const { id, requestFunction, status } = res[resChecker];
					if (status === "fail") {
						requestFailLimit--;
						batchFailLimit--;

						await checkRateState();

						res[resChecker] = (async () => {
							try {
								return {
									id: id,
									status: "sucess",
									date: Date.now(),
									result: await requestFunction()
								}
							} catch (e) {
								console.error(`error:`, e);
								return {
									id: id,
									status: "fail",
									errorMessage: e,
									requestFunction: requestFunction
								}
							}
						})();
					}
				}

				if (batchFailLimit === batchSize) {
					break;
				} else if (!batchFailLimit) {
					requestFailLimit = 0;
					break;
				}
				res = await Promise.all(requests);
			}
			if (!requestFailLimit) {
				console.error("requeus fail limit exceeded!");
				return results;
			}

			results.push.apply(results, res);
			console.log('Finished batch: ' + results.length + '/' + arr.length);

			if (end === arr.length) break;
			start = end;
			end = Math.min(arr.length, start + batchSize);
		}
		return results;
	}
	return Promise_allBatched;
})();


let getRepoIssues = async (owner, repo, qualifier = { state: "" }) => {
	const fileName = `${repo}_data/issues.json`;

	if (fs.existsSync(`./${fileName}`)) {
		console.log(`Repostory:${repo}'s issues data exist.`);
		return JSON.parse(fs.readFileSync(`./${fileName}`, 'utf-8'));
	}

	console.log(`Loading ${repo} issues data....`);

	await checkRateState();

	const closedIssues = await octokit.paginate('/repos/{owner}/{repo}/issues', {
		owner: owner,
		repo: repo,
		state: qualifier.state,
		mediaType: {
			previews: [
				'mockingbird'
			]
		}
	});
	const realIssues = closedIssues.filter((issue) => !issue.pull_request);

	const absFileName = path.join(__dirname, fileName);
	fs.mkdirSync(`${repo}_data`, { recursive: true });
	fs.writeFileSync(absFileName, JSON.stringify(realIssues, null, 2));
	console.log("Issues load sucessfal.");

	return realIssues;
}



let getIssuesWithEvent = async (owner, repo, issues, dataSize = 0) => {
	const fileName = `${repo}_data/issues_with_events.json`;

	if (fs.existsSync(`./${fileName}`)) {
		console.log(`Repostory:${repo}'s issues with events data exist.`);
		return JSON.parse(fs.readFileSync(`./${fileName}`, 'utf-8'));
	}

	console.log(`Loading ${repo} events timeline with issues....`);
	// console.log(realIssues.length);

	const batchSize = 100;

	let counter = 0;
	let inflightQueries = 0;

	if (dataSize) {
		issues = issues.slice(0, dataSize);
	}

	const promises = await Promise_allBatched(issues.map((issue) =>
		async () => {
			console.log("counter:", ++counter, ++inflightQueries);
			try {
				const res = await octokit.rest.issues.listEventsForTimeline({
					owner: owner,
					repo: repo,
					issue_number: issue.number,
					mediaType: {
						previews: [
							'mockingbird'
						]
					}
				});

				return {
					issue,
					events: res.data
				};
			} finally {
				inflightQueries--;
			}
		}
	), batchSize);

	const issuesWithEvents = promises.map((promise) => promise.result);

	const absFileName = path.join(__dirname, fileName);
	fs.mkdirSync(`${repo}_data`, { recursive: true });
	fs.writeFileSync(absFileName, JSON.stringify(issuesWithEvents, null, 2));
	console.log("Issues with events load sucessful!");

	return issuesWithEvents;
}


let getIssuesHasPr_pullRequestUrls = (owner, repo, issuesWithEvents) => {
	const fileName = `${repo}_data/IssuesHasPr_and_prUrlList.json`;

	if (fs.existsSync(`./${fileName}`)) {
		console.log(`Repostory:${repo}'s issues has pull request & urls data exist.`);
		return JSON.parse(fs.readFileSync(`./${fileName}`, 'utf-8'));
	}

	let prUrlSet = new Set();
	let issuesHasPr = issuesWithEvents.filter((issueWithEvents) => {
		issueWithEvents.prEvents = issueWithEvents.events.filter((event) => event.source?.issue.pull_request);
		// console.log(issueWithEvents.prEvents);
		for (const prEvent of issueWithEvents.prEvents) {
			const  issue  = prEvent.source.issue;
			prUrlSet.add(`/repos/${issue.repository.owner.login}/${issue.repository.name}/pulls/${issue.number}`);
		}
		return issueWithEvents.prEvents.length;
	})

	const prUrlList = Array.from(prUrlSet);

	const absFileName = path.join(__dirname, fileName);
	fs.mkdirSync(`${repo}_data`, { recursive: true });
	fs.writeFileSync(absFileName, JSON.stringify({ issuesHasPr: issuesHasPr, prUrlList: prUrlList }, null, 2));

	return { issuesHasPr: issuesHasPr, prUrlList: prUrlList };
}

let getMergedPrs = async (owner, repo, prUrlList, dataSize = 0) => {
	const fileName = `${repo}_data/merged_pull_requests.json`;

	if (fs.existsSync(`./${fileName}`)) {
		console.log(`Repostory:${repo}'s merged pull requests data exist.`);
		return JSON.parse(fs.readFileSync(`./${fileName}`, 'utf-8'));
	}

	console.log(`Loading ${repo} pull request data....`);

	const batchSize = 100;

	let inflightQueries = 0;
	let counter = 0;

	if (dataSize) {
		prUrlList = prUrlList.slice(0, dataSize);
	}

	const promises = await Promise_allBatched(prUrlList.map((url) =>
		async () => {
			console.log("counter:", ++counter, ++inflightQueries);
			try {
				const res = await octokit.rest.pulls.get(url);

				return {
					data: res.data,
					lineChanged: res.data.additions + res.data.deletions
				};
			} finally {
				inflightQueries--;
			}
		}
	), batchSize);

	// console.log(JSON.stringify(promises,null,2));

	const mergedPrs = promises.filter((promise) => promise.result?.data.base.repo.name === repo && promise.result?.data.merged).map((promise) => [promise.result.data.number, promise.result]);
	
	const absFileName = path.join(__dirname, fileName);
	fs.mkdirSync(`${repo}_data`, { recursive: true });
	fs.writeFileSync(absFileName, JSON.stringify(mergedPrs, null, 2));
	console.log("Mereged pull request load sucessful!");

	return mergedPrs;
}


export default async function repoIssuesFilter(owner, repository){
	// const owner = "Domiii";
	// const repository = "dbux";

	const issues = await getRepoIssues(owner, repository, { state: "closed" });
	const issuesWithEvents = await getIssuesWithEvent(owner, repository, issues, 100);
	const { issuesHasPr, prUrlList } = await getIssuesHasPr_pullRequestUrls(owner, repository, issuesWithEvents);
	const mergedPrs = await getMergedPrs(owner, repository, prUrlList, 100);
	
	const mergedPrsSet = new Map(mergedPrs);
	const lineChangedQualifier = 1000;
	// console.log(mergedPrsSet);

	const final = issuesHasPr.filter((issue) => {
		issue.prs = issue.prEvents.map((pr) => mergedPrsSet.get(pr.source.issue.number)).filter((pr) => pr);
		issue.TotalLineChanged = issue.prs.reduce((a, b) => a + b.lineChanged, 0);
		return issue.prs.length && issue.TotalLineChanged <= lineChangedQualifier;
	})

	const finalFileName = path.join(__dirname, `${repository}_data/filter_result.json`);
	fs.mkdirSync(`${repository}_data`, { recursive: true });
	fs.writeFileSync(finalFileName, JSON.stringify(final, null, 2));

	//show table

	const table = {
		repository: repository,
		owner: owner,
		issues: final.map((issueWithEvents) => {
			return {
				title: issueWithEvents.issue.title,
				issue_url: issueWithEvents.issue.html_url,
				count_of_pr: issueWithEvents.prs.length,
				TotalLineChanged: issueWithEvents.TotalLineChanged
			}
		}),
		count_of_issue: final.length
	}

	const tableFileName = path.join(__dirname, `${repository}_data/table.json`);
	fs.writeFileSync(tableFileName, JSON.stringify(table, null, 2));
	console.log(table);
}

repoIssuesFilter("Domiii","dbux");