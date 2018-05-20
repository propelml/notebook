// Tests for the router component.
import { h, render, rerender } from "preact";
import { testBrowser } from "../tools/tester";
import { push, Router } from "./router";
import { assertEqual } from "./util";

const matchedProps = new Map<string, any>();

interface ComponentProps {
  id: string;
  matches?: any;
  path?: string;
}
// tslint:disable-next-line:variable-name
const Test = (props: ComponentProps) => {
  matchedProps.set(props.id, props.matches);
  return (
    <div id={props.id} class="test" />
  );
};

testBrowser(async function router() {
  document.body.innerHTML = "";
  render(
    <Router>
      <Test id="p1" path="/" />
      <Test id="p2" path="/test" />
      <Test id="p3" path="/page/:v" />
      <Test id="p4" path="/test/:v" />
      <Test id="404" />
    </Router>
    , document.body);
  // .slice(1) is to remove # from the location.hash.
  const path = () => document.location.hash.slice(1);
  const activePage = () => {
    const rendered = document.querySelectorAll(".test");
    // We must render only one component at each moment.
    assertEqual(rendered.length, 1);
    return rendered[0].id;
  };
  // Rest path.
  window.location.hash = "/";
  await flush();
  // Initial page.
  assertEqual(path(), "/");
  assertEqual(activePage(), "p1");
  // 404 page.
  push("/propel");
  await flush();
  assertEqual(path(), "/propel");
  assertEqual(activePage(), "404");
  // We must not render p2 in this case.
  push("/test/12345");
  await flush();
  assertEqual(path(), "/test/12345");
  assertEqual(activePage(), "p4");
  assertEqual(matchedProps.get("p4").v, "12345");
  // Go to a page with some argument.
  push("/page/345");
  await flush();
  assertEqual(path(), "/page/345");
  assertEqual(activePage(), "p3");
  assertEqual(matchedProps.get("p3").v, "345");
});

// Call this to ensure that the DOM has been updated after events.
function flush(): Promise<void> {
  rerender();
  return Promise.resolve();
}
