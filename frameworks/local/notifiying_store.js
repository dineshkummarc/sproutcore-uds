/*globals SCUDS*/
/**
 * NotifyingStore will notify the data source (usually SCUDS.NotifyingCascadeDataSource)
 * of any changes that should be bubbled through all data sources.
 *
 * @author Geoffrey Donaldson
 * @author Sean Eidemiller
 */
SCUDS.NotifyingStore = SC.Store.extend({

  /**
   * A hash of timestamps for the lastRetrievedAt time for each record type.
   */
  lastRetrievedAt: {},

  /**
   * Overrides loadRecords() because we want it to invoke loadRecord() with an ignoreNotify
   * parameter.  It also notifies the data source on completion.
   *
   * For the most part, however, it does the same thing.
   */
  loadRecords: function(recordTypes, dataHashes, ids) {
    var isArray = SC.typeOf(recordTypes) === SC.T_ARRAY;
    var len = dataHashes.get('length');
    var ret = [];
    var K = SC.Record;
    var recordType, id, primaryKey, idx, dataHash, storeKey;

    // Save lookup info.
    if (!isArray) {
      recordType = recordTypes || SC.Record;
      primaryKey = recordType.prototype.primaryKey;
    }

    // Load each record individually.
    for (idx = 0; idx < len; idx++) {
      dataHash = dataHashes.objectAt(idx);
      if (isArray) {
        recordType = recordTypes.objectAt(idx) || SC.Record;
        primaryKey = recordType.prototype.primaryKey;
      }

      id = (ids) ? ids.objectAt(idx) : dataHash[primaryKey];
      storeKey = this.loadRecord(recordType, dataHash, id, YES);
      if (storeKey) ret.push(storeKey);
    }

    var ds = this._getDataSource();

    if (ds.wantsNotification) {
      ds.notifyDidLoadRecords(this, recordType, dataHashes, ids);
    }

    return ret;
  },

  /**
   * Overrides loadRecord() to notifiy the data source on completion.
   */
  loadRecord: function(recordType, dataHash, id, ignoreNotify) {
    var dataSource = this._getDataSource();

    if (dataHash.status === "deleted") {
      SC.RunLoop.begin();
      this.pushDestroy(recordType, id);
      SC.RunLoop.end();
      return null;
    }

    var ret = sc_super();

    if (ignoreNotify !== YES && dataSource.wantsNotification) {
      dataSource.notifyDidLoadRecord(this, recordType, dataHash, id);
    }

    return ret;
  },

  /**
   * Overrides dataSourceDidComplete() to accept an optional notify parameter.
   */
  dataSourceDidComplete: function(storeKey, dataHash, newId, notify) {
    var status = this.readStatus(storeKey), K = SC.Record, statusOnly;

    if (!(status & K.BUSY) || status === K.BUSY_DESTROYING) {
      throw K.BAD_STATE_ERROR;
    } else status = K.READY_CLEAN;

    this.writeStatus(storeKey, status);
    if (newId) SC.Store.replaceIdFor(storeKey, newId);
    if (dataHash) this.writeDataHash(storeKey, dataHash, status, notify);

    statusOnly = dataHash || newId ? NO : YES;
    this.dataHashDidChange(storeKey, null, statusOnly);

    return this;
  },

  /**
   * Overrides writeDataHash() to accept an optional notify parameter and notify the data source on
   * completion if YES.
   */
  writeDataHash: function(storeKey, dataHash, status, notify) {
    var ret = sc_super();

    if (notify === YES) {
      var ds = this._getDataSource();
      if (ds.wantsNotification) {
        var id = this.idFor(storeKey);
        var recordType = this.recordTypeFor(storeKey);
        ds.notifyDidWriteRecord(this, recordType, dataHash, id);
      }
    }

    return ret;
  },

  /**
   * Overrides removeDataHash() to notify the data source on completion.
   */
  removeDataHash: function(storeKey, status) {
    var ds = this._getDataSource();

    if (ds.wantsNotification) {
      var id = this.idFor(storeKey);
      var recordType = this.recordTypeFor(storeKey);
      ds.notifyDidDestroyRecord(this, recordType, id);
    }

    return sc_super();
  }
});

