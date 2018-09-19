// @flow

// babel-preset-react-app uses useBuiltIn "entry". We therefore need an entry
// polyfill import to be replaced with polyfills we need for our targeted browsers.
import '@babel/polyfill';

import React from 'react';
import BaseApp, { Container } from 'next/app';
import Router from 'next/router';
import Error from 'next/error';
import UAParser from 'ua-parser-js';

import GlobalStyle from '../GlobalStyle';
import LeafletStyle from '../LeafletStyle';
import AppStyle from '../AppStyle';
import MapStyle from '../MapStyle';
import {
  expandedPreferredLocales,
  loadExistingLocalizationByPreference,
  parseAcceptLanguageString,
} from '../lib/i18n';
import Categories from '../lib/Categories';
import router from '../router';

export default class App extends BaseApp {
  static async getInitialProps({ Component: PageComponent, ctx }) {
    let props = {};
    let categories, locales, userAgent, translations;

    try {
      let languages;
      let userAgentString;

      if (ctx.req) {
        if (ctx.req.headers['accept-language']) {
          languages = parseAcceptLanguageString(ctx.req.headers['accept-language']);
        }

        userAgentString = ctx.req.headers['user-agent'];
      } else {
        languages = window.navigator.languages;
      }

      const userAgentParser = new UAParser(userAgentString);
      userAgent = userAgentParser.getResult();

      if (languages) {
        locales = expandedPreferredLocales(languages);
        translations = await loadExistingLocalizationByPreference(locales);

        categories = await Categories.generateLookupTables({
          locale: locales[0],
        });
      }

      // Fetch child component props and fetch errors if anything happens.
      if (PageComponent.getInitialProps) {
        props = await PageComponent.getInitialProps(ctx);
      }
    } catch (error) {
      if (ctx.res) {
        ctx.res.statusCode = error.statusCode || 500;
      }

      props.error = error;
    }

    return { ...props, translations, categories, userAgent };
  }

  pushRoute(name: string, params: { [name: string]: any } = {}) {
    const route = router.getRoute(name, true);
    const path = router.generate(name, params);

    if (!route.nextPage) {
      throw new Error('Route is missing next page.');
    }

    Router.push({ pathname: route.nextPage, query: params }, path);
  }

  render() {
    const { Component: PageComponent, error, ...props } = this.props;

    if (error) {
      console.log(error);
    }

    return (
      <Container>
        {error ? (
          <div>
            {error.message}
            <Error statusCode={error.statusCode} />
          </div>
        ) : (
          <PageComponent pushRoute={this.pushRoute} {...props} />
        )}
        <GlobalStyle />
        <LeafletStyle />
        <AppStyle />
        <MapStyle />
      </Container>
    );
  }
}