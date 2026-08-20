const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:\\Users\\Yusuf\\.gemini\\antigravity-ide\\brain\\3dee3594-41f6-495d-8279-3da7a2da8804\\.system_generated\\logs\\transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let latestCode = null;

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      if (step.tool_calls) {
        for (const call of step.tool_calls) {
          if (call.name === 'default_api:write_to_file' || call.name === 'default_api:replace_file_content') {
            const args = JSON.parse(call.arguments);
            if (args.TargetFile && args.TargetFile.endsWith('app\\page.js')) {
               if (args.CodeContent) {
                 latestCode = args.CodeContent;
               }
            }
          }
        }
      }
    } catch (e) {}
  }
  
  if (latestCode) {
    fs.writeFileSync('app/page_recovered.js', latestCode);
    console.log("Recovered to app/page_recovered.js");
  } else {
    console.log("Not found in full write_to_file. Let me check replace_file_content.");
  }
}

processLineByLine();
