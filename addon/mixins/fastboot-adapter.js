import Mixin from '@ember/object/mixin';
import { inject as service } from '@ember/service';
import { resolve } from 'rsvp';
import { cacheKey, shoeboxize } from 'ember-data-storefront/-private/utils/get-key';

/**
  This mixin adds fastboot support to your data adapter. It provides no
  public API, it only needs to be mixed into your adapter.

  ```js
  // app/adpaters/application.js

  import JSONAPIAdapter from 'ember-data/adapters/json-api';
  import FastbootAdapter from 'ember-data-storefront/mixins/fastboot-adapter';

  export default JSONAPIAdapter.extend(
    FastbootAdapter, {

    // ...

  });
  ```

  @class FastbootAdapter
  @public
*/
export default Mixin.create({
  fastboot: service(),
  storefront: service(),

  ajax(url, type, options = {}) {
    let cachedPayload = this._getStorefrontBoxedQuery(type, url, options.data);
    let maybeAddToShoebox = this._makeStorefrontQueryBoxer(type, url, options.data);

    return cachedPayload ?
      resolve(JSON.parse(cachedPayload)) :
      this._super(...arguments).then(maybeAddToShoebox);
  },

  _makeStorefrontQueryBoxer(type, url, params) {
    let fastboot = this.get('fastboot');
    let isFastboot = fastboot && fastboot.get('isFastBoot');
    let cache = this.get('storefront.fastbootDataRequests');
    let extraCacheKeyProps = this.extraCacheKeyProps && this.extraCacheKeyProps();
    let includeInCache = !this._isExclusion(url, this.excludeFromFastbootCache);
    return function(response) {
      if (isFastboot && includeInCache) {
        let key = shoeboxize(cacheKey([type, url, params, extraCacheKeyProps]));
        cache[key] = JSON.stringify(response);
      }

      return response;
    }
  },

  _getStorefrontBoxedQuery(type, url, params) {
    let payload;
    let fastboot = this.get('fastboot');
    let isFastboot = fastboot && fastboot.get('isFastBoot');
    let shoebox = fastboot && fastboot.get('shoebox');
    let box = shoebox && shoebox.retrieve('ember-data-storefront');
    let extraCacheKeyProps = this.extraCacheKeyProps && this.extraCacheKeyProps();

    if (!isFastboot && box && box.queries && Object.keys(box.queries).length > 0) {
      let key = shoeboxize(cacheKey([type, url, params, extraCacheKeyProps]));
      payload = box.queries[key];
      delete box.queries[key];
    }

    return payload;
  },

  _isExclusion(url, excludeList) {
    if (!Array.isArray(excludeList)) {
      return false;
    }
    return excludeList.reduce(function (previous, currentEntry) {
      if (currentEntry[0] === '/' &&
        currentEntry.slice(-1) === '/') {
        // RegExp as string
        var regexp = new RegExp(currentEntry.slice(1, -1));
        return previous || regexp.test(url);
      }
      else {
        return previous || currentEntry === url;
      }
    }, false);  
  }

})
