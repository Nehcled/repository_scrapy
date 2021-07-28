export async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


  // const closedIssues = await octokit.rest.issues.get('/repos/{owner}/{repo}/issues',{
  //   owner:"jquery",
  //   repo:"jquery",
  //   state:"closed",
  //   per_page:100,
  //   mediaType: {
  //     previews: [
  //       'mockingbird'
  //     ]
  //   }
  // });
  // console.log(closedIssues);
  // filter pull_request
  // const realIssues = closedIssues.data.filter((issue)=>!issue.pull_request);

  // let closedIssues = [];
  // for await(const response of octokit.paginate.iterator("/repos/{owner}/{repo}/issues",{
  //   owner:"jquery",
  //   repo:"jquery",
  //   state:"closed",
  //   per_page:100,
  //   mediaType: {
  //     previews: [
  //       'mockingbird'
  //     ]
  //   }
  // })){
  //   console.log(response.url);
  //   closedIssues = closedIssues.concat(response.data);
  // }
  // console.log(closedIssues.length);