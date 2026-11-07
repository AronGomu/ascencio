import type {
  FullConfig,
  Reporter,
  Suite,
  TestError,
} from "@playwright/test/reporter";

export default class BrowserCollectionReporter implements Reporter {
  onError(error: TestError): void {
    console.error(error.message ?? error.value);
  }
  onBegin(_config: FullConfig, suite: Suite): void {
    console.log(
      JSON.stringify(
        suite.allTests().map((test) => ({
          file: test.location.file,
          title: test.titlePath().join(" > "),
          expectedStatus: test.expectedStatus,
        })),
      ),
    );
  }
}
