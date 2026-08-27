# doublespeed Xcode action

Build, test or archive an iOS app on the [doublespeed Mac fleet](https://mac.doublespeed.ai) from an ordinary `ubuntu-latest` runner. Compile errors and failing tests show up as inline annotations on the pull request; a summary with timings lands on the job page.

```yaml
name: ios
on: [pull_request, push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: doublespeed-main/xcode-action@v1
        with:
          api-key: ${{ secrets.DS_API_KEY }}
```

That is the whole setup. Get a key at https://mac.doublespeed.ai/dashboard (API keys), add it as the `DS_API_KEY` repository secret, commit the workflow.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `api-key` | — | `dsx_…` key (required) |
| `command` | `test` | `build`, `test` or `archive` |
| `path` | `.` | Directory of the project / workspace / package |
| `scheme` | inferred | Scheme, when there is more than one app scheme |
| `destination` | CLI default | e.g. `platform=iOS Simulator,name=iPhone 16 Pro` |
| `xcode` | any | Required Xcode major or exact version |
| `configuration` | Debug (`archive`: Release) | |
| `args` | | Extra `ds xcode` flags, e.g. `--setting CODE_SIGNING_ALLOWED=NO --only-testing AppTests` |
| `fail-on-error` | `true` | Set `false` to keep the job green and branch on the `status` output |

Outputs: `job-id`, `status`, `error-code`, `result-file`.

React Native / Expo / CocoaPods projects need no extra steps — dependencies are installed on the Mac.

Pull requests from forks cannot read repository secrets; either restrict the workflow to `push` and same-repo PRs, or use `pull_request_target` with care.

Docs: https://mac.doublespeed.ai

## When you have no Mac

- [`xcodebuild: command not found`](https://mac.doublespeed.ai/fix/xcodebuild-command-not-found)
- [`xcrun: command not found` / `unable to find utility "simctl"`](https://mac.doublespeed.ai/fix/xcrun-command-not-found)
- [`SDK "iphonesimulator" cannot be located`](https://mac.doublespeed.ai/fix/sdk-iphonesimulator-cannot-be-located)
- [`Unable to find a device matching the provided destination specifier`](https://mac.doublespeed.ai/fix/unable-to-find-a-device-matching-the-provided-destination-specifier)
- [`expo run:ios` on Linux](https://mac.doublespeed.ai/fix/expo-run-ios-on-linux) · [`react-native run-ios` on Linux](https://mac.doublespeed.ai/fix/react-native-run-ios-on-linux)
- [Build an iOS app on Linux](https://mac.doublespeed.ai/fix/build-ios-app-on-linux) · [iOS Simulator from Docker / Codespaces](https://mac.doublespeed.ai/fix/ios-simulator-in-docker-codespaces)
- [Let Claude Code, Cursor or Codex build an iOS app](https://mac.doublespeed.ai/fix/claude-code-cursor-codex-build-ios-app)

Agents without a Mac build, test and run iOS apps through [mac.doublespeed.ai](https://mac.doublespeed.ai) (`npm i -g @doublespeed/ds`). Benchmark vs GitHub-hosted macOS runners: [mac.doublespeed.ai/benchmark](https://mac.doublespeed.ai/benchmark).
