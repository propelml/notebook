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

import { Component, ComponentConstructor, h } from "preact";
import * as db from "./db";
import { push, Router } from "./router";
import * as types from "./types";
import { equal } from "./util";

import { ErrorPage } from "./components/error";
import { GlobalHeader } from "./components/header";
import { Home } from "./components/home";
import { Loading } from "./components/loading";
import { UserMenu } from "./components/menu";
import { Notebook } from "./components/notebook";
import { Profile } from "./components/profile";
import { Recent } from "./components/recent";

type Partial<T> = { [K in keyof T]?: T[K] };

type ReadOnly<T> = { readonly [K in keyof T]: T[K] };

interface PageProps {
  path: string;
  matches?: { [key: string]: string };
  onReady?: () => void;
}

type BindProps<P> = {
  [K in keyof P]?: (props: ReadOnly<BoundProps<P>>) => Promise<P[K]>
};

type BoundProps<P> = PageProps & BindProps<P>;

interface BindStateNormal<P> {
  data: { [K in keyof P]: P[K] };
  error: null;
}

interface BindStateError {
  data: null;
  error: string;
}

type BindState<P> = BindStateNormal<P> | BindStateError;

/**
 * This react HOC can be used to bind result of some async
 * methods to props of the given component (C).
 * see: https://reactjs.org/docs/higher-order-components.html
 *
 *   const newComponent = bind(Component, {
 *     async prop(props) {
 *       const re = await someAsyncActions();
 *       return re;
 *     }
 *   });
 */
function bind<P>(C: ComponentConstructor<P, {}>, bindProps: BindProps<P>) {
  return class extends Component<BoundProps<P>, BindState<P>> {
    state = { data: null, error: null };
    prevMatches = null;
    componentRef;

    private onReady() {
      if (this.props.onReady) this.props.onReady();
    }

    async loadData() {
      if (equal(this.props.matches, this.prevMatches)) return;
      this.prevMatches = this.props.matches;
      const data: Partial<P> = {};
      for (const key in bindProps) {
        if (!bindProps[key]) continue;
        try {
          data[key] = await bindProps[key](this.props);
        } catch (e) {
          this.setState({ data: null, error: e.message });
          return;
        }
      }
      this.setState({ data: data as P, error: null });
    }

    render() {
      this.loadData();
      const { data, error } = this.state;
      if (error) return <ErrorPage message={error} />;
      if (!data) return <Loading />;
      this.onReady();
      return <C ref={r => (this.componentRef = r)} {...this.props} {...data} />;
    }
  };
}

// An anonymous notebook doc for when users aren't logged in
export const anonDoc = {
  anonymous: true,
  cells: [],
  created: new Date(),
  owner: {
    displayName: "Anonymous",
    photoURL: require("./img/anon_profile.png"),
    uid: ""
  },
  title: "Anonymous Notebook",
  updated: new Date()
};

// TODO Move these components to ./pages.tsx.
// tslint:disable:variable-name
async function onNewNotebook() {
  const nbId = await db.active.create();
  // Redirect to new notebook.
  push(`/notebook/${nbId}`);
}

async function onOpenNotebook(nbId: string) {
  // Redirect to notebook.
  push(`/notebook/${nbId}`);
}

export const RecentPage = bind(Recent, {
  notebooks() {
    return db.active.queryLatest();
  },
  async onNewNotebook() {
    return () => onNewNotebook();
  },
  async onOpenNotebook() {
    return (nbId: string) => onOpenNotebook(nbId);
  }
});

export const ProfilePage = bind(Profile, {
  notebooks(props) {
    const uid = props.matches.userId;
    return db.active.queryProfile(uid, 100);
  },
  async onNewNotebook() {
    return () => onNewNotebook();
  },
  async onOpenNotebook() {
    return (nbId: string) => onOpenNotebook(nbId);
  }
});

export const NotebookPage = bind(Notebook, {
  initialDoc(props) {
    const nbId = props.matches.nbId;
    return nbId === "anonymous"
      ? Promise.resolve(anonDoc)
      : db.active.getDoc(nbId);
  },
  save(props) {
    const nbId = props.matches.nbId;
    const cb = async doc => {
      if (doc.anonymous) return;
      if (!props.userInfo) return;
      if (props.userInfo.uid !== doc.owner.uid) return;
      try {
        await db.active.updateDoc(nbId, doc);
      } catch (e) {
        // TODO
        console.log(e);
      }
    };
    return Promise.resolve(cb);
  },
  clone(props) {
    const cb = async doc => {
      const cloneId = await db.active.clone(doc);
      // Redirect to new notebook.
      push(`/notebook/${cloneId}`);
    };
    return Promise.resolve(cb);
  }
});

export const HomePage = bind(Home as any, {});

// tslint:enable:variable-name

export interface AppState {
  loadingAuth: boolean;
  userInfo: types.UserInfo;
}

export class App extends Component<{}, AppState> {
  state = {
    loadingAuth: true,
    userInfo: null
  };

  unsubscribe: db.UnsubscribeCb;
  componentWillMount() {
    this.unsubscribe = db.active.subscribeAuthChange(userInfo => {
      this.setState({ loadingAuth: false, userInfo });
    });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  render() {
    const { userInfo } = this.state;
    return (
      <div class="notebook">
        <GlobalHeader subtitle="Notebook" subtitleLink="/notebook">
          <UserMenu userInfo={userInfo} />
        </GlobalHeader>
        <Router>
          <HomePage path="/" />
          <RecentPage path="/notebook" userInfo={userInfo} />
          <NotebookPage path="/notebook/:nbId" userInfo={userInfo} />
          <ProfilePage path="/user/:userId" userInfo={userInfo} />
          <ErrorPage message="The page you're looking for doesn't exist." />
        </Router>
      </div>
    );
  }
}
