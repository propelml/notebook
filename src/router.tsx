/*!
   Copyright 2018 Propel http://propel.site/.  All rights reserved.
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

import { createHashHistory } from "history";
import pathToRegexp from "path-to-regexp";
import { cloneElement, Component, VNode } from "preact";

let id = 0;
const listeners = new Map<number, () => void>();
const history = createHashHistory();
const regexCache = new Map<string, RegExp>();
const regexKeysCache = new Map<string, string[]>();

export interface MatchedResult {
  [key: string]: string;
}

export function match(pattern: string): false | MatchedResult {
  const path = history.location.pathname;
  let regex = regexCache.get(pattern);
  let keys = regexKeysCache.get(pattern);
  if (!regex) {
    const mKeys = [];
    regex = pathToRegexp(pattern, mKeys);
    keys = mKeys.map(x => x.name);
    regexCache.set(pattern, regex);
    regexKeysCache.set(pattern, keys);
  }
  const re = regex.exec(path);
  if (!re) return false;
  const data = {};
  for (const i in keys) {
    if (!keys[i]) continue;
    const key = keys[i];
    data[key] = re[1 + Number(i)];
  }
  return data;
}

export interface RouterChildProps {
  path?: string;
}

export type RouterChild = VNode<RouterChildProps>;

export interface RouterProps {
  children?: RouterChild[];
}

export interface RouterState {
  active: number | string;
  props: MatchedResult;
}

export class Router extends Component<RouterProps, RouterState> {
  state = {
    active: null,
    props: null
  };
  id: number;

  onLocationChange() {
    const children: RouterChild[] = this.props.children;
    for (const i in children) {
      if (!children[i]) continue;
      const child = children[i];
      const attributes = child.attributes;
      if (!attributes || !attributes.path) {
        this.setState({ active: i, props: null });
        return;
      }
      const props = match(attributes.path);
      if (!props) continue;
      this.setState({ active: i, props });
      return;
    }
    this.setState({ active: null, props: null });
  }

  componentWillMount() {
    this.id = id++;
    listeners.set(this.id, this.onLocationChange.bind(this));
    this.onLocationChange();
  }

  componentWillUnmount() {
    listeners.delete(this.id);
  }

  componentWillReceiveProps() {
    this.onLocationChange();
  }

  render() {
    const { active, props } = this.state;
    if (active === null) return null;
    const activeEl = this.props.children[active];
    const newProps = { ...activeEl.attributes, matches: props };
    return cloneElement(activeEl, newProps);
  }
}

export function push(url) {
  history.push(url);
}

export function back() {
  history.goBack();
}

history.listen(() => {
  const listenerCbs = listeners.values();
  for (const cb of listenerCbs) {
    cb();
  }
});
