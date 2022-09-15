const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.Jira=function(token, user, host){
    const jiraAuth = btoa(`${user}:${token}`);
    
    this.getStatus = async function(issue){
        const url = `${host}/rest/api/2/issue/${issue}?fields=status`
        let response = await fetch(url, { headers : {
            'Authorization': 'Basic ' + jiraAuth,
            'Content-Type': 'application/json'
          } 
        });
        if (response.ok) {
            const json = await response.json();
            return json.fields
        }
        return null
    }

    this.createTask = async function(data, linked){ 
        const issueUrl = `${host}/rest/api/3/issue`
        const payload = {
            "fields": data
        }
        if(linked.length > 0){
            payload.update = {
                "issuelinks": [
                    {
                        "add": {
                            "type": {
                                "name": "Blocks",
                                "inward": "relates to",
                                "outward": "blocks"
                            },
                            "outwardIssue": {
                                "key": linked[0]
                            }
                        }
                    }
                ]
            }
        }

        let issueResponse = await fetch(issueUrl, 
            { headers : {
                'Authorization': 'Basic ' + jiraAuth,
                'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify(payload)
            });
        
        //  INFO: There are bug on jira API (cannot link multiple issue in the same time). So we force it manually
        // https://confluence.atlassian.com/jirakb/how-to-use-rest-api-to-add-issue-links-in-jira-issues-939932271.html
        if (issueResponse.ok) {
            const res = await issueResponse.json();
            for(let i=1; i < linked.length; i++){
                const updatePayload =  {
                    "update": {
                        "issuelinks": [
                            {
                                "add": {
                                    "type": {
                                        "name": "Blocks",
                                        "inward": "relates to",
                                        "outward": "blocks"
                                    },
                                    "outwardIssue": {
                                        "key": linked[i]
                                    }
                                }
                            }
                        ]
                    }
                }
                await fetch(`${issueUrl}/${res.key}`, { headers : {
                        'Authorization': 'Basic ' + jiraAuth,
                        'Content-Type': 'application/json'
                        },
                        method: 'PUT',
                        body: JSON.stringify(updatePayload)
                    });
            }
            return res.key
        }
        return null
    }
}