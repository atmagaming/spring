import { execSync } from "child_process";

// Should start with fix, feat, docs, style, refactor, perf, test, chore, or revert
{
    const message = process.argv[2];
    const regex = /^(fix|feat|docs|style|refactor|perf|test|chore|revert): /;
    console.log(message);
    if (!regex.test(message)) {
        console.error(
            "Commit message should start with fix, feat, docs, style, refactor, perf, test, chore, or revert",
        );
        process.exit(1);
    }
}

// Check the current branch
{
    const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    const regex = /^(master|develop|feature|fix|hotfix)/;
    if (!regex.test(branch)) {
        console.error("Branch name should start with master, develop, feature, fix, or hotfix");
        process.exit(1);
    }
}
