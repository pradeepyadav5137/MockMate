const { cli, defineAgent, WorkerOptions } = require('@livekit/agents');

const agent = defineAgent({
  entry: async (ctx) => {
    console.log("Agent started!");
  }
});

module.exports = agent;

if (require.main === module) {
  console.log("Calling runApp");
  cli.runApp(new WorkerOptions({
    agent: __filename
  }));
}
