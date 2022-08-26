const {google} = require('googleapis');
const {auth} = require('google-auth-library');

exports.Sheet = function(keys, spreadsheetId){
    const key = JSON.parse(keys);
    const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
    let jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        SCOPES);
   
    this.service = google.sheets({version: 'v4', auth: jwtClient});
    
    this.batchGet = async function(ranges){
        try {
            const result = await this.service.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges,
            });
            return result.data.valueRanges;
        } catch (err) {
            console.log(err)
        }
    }

    this.valueToArray = function(data){
        let rows
        data.map(({ values }) => rows = values)
        rows.shift()
        return rows
    }

    this.valuesToObjects = function(data){
        let rows
        data.map(({ values }) => rows = values)
        let objects = []
        for(let i=0; i < rows.length; i++){
            if(i==0) continue
            let obj = {}
            for (let j = 0; j < rows[0].length; j++){
                obj[rows[0][j]] = rows[i][j] 
            }
            objects.push(obj)
        }
        return objects
    }

    this.getHeaders = function(data){
        let rows
        data.map(({ values }) => rows = values)
        return rows[0]
    }

    this.getEmptyValueHeaderObject = function(data){
        let rows
        data.map(({ values }) => rows = values)
        let obj = {}
        for(const header of rows[0]){
            obj[header] = ''
        }
        return obj
    }

    this.append = function(ranges, values){
        try {
            this.service.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: ranges,
                valueInputOption: "USER_ENTERED",
                resource: {
                    "values": [values]
                  }
            })
          } catch (err) {
            console.error(err);
          }
    }

    this.appendWithObject = function(ranges, obj){
        const values = Object.values(obj);
        try {
            this.service.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: ranges,
                valueInputOption: "USER_ENTERED",
                resource: {
                    "values": [values]
                  }
            })
          } catch (err) {
            console.error(err);
          }
    }

    this.updateValue = async function(ranges, values){
        try {
            const response = (await service.spreadsheets.values.batchUpdate({
                spreadsheetId: spreadsheetId,
                range: ranges,
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [values]
                  }

            })).data;
            // TODO: Change code below to process the `response` object:
            console.log(JSON.stringify(response, null, 2));
          } catch (err) {
            console.error(err);
          }
    }
}