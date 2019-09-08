Components.utils.import("resource://gre/modules/Preferences.jsm");
Components.utils.import("resource://gre/modules/Task.jsm");

var abHere2 = {
    ACTION_ADD: 1,
    BOOKMARK_ITEM: 0,
    BOOKMARK_ITEMS: 9,

    hackFunc: function(obj, name, preFunc, endFunc) {
        try {
            let injectId = (new Error).stack.split("\n")[1]; // use hackFunc's caller line-number as injectId
            if (Array.isArray(obj[name].injectList) && (obj[name].injectList.indexOf(injectId) !== -1)) {
                return;
            }
            let orgFunc = obj[name];
            if (orgFunc.isAsyncFunction) {
                obj[name] = Task.async(function*() {
                    let args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments)); args.unshift(arguments);
                    if (typeof(preFunc) === 'function') { let retval = yield preFunc.apply(this, args); if (retval !== undefined) { return retval; } }
                    let retval = yield orgFunc.apply(this, arguments);
                    if (typeof(endFunc) === 'function') { let retval = yield endFunc.apply(this, args); if (retval !== undefined) { return retval; } }
                    return retval;
                });
            } else {
                obj[name] = function() {
                    let args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments)); args.unshift(arguments);
                    if (typeof(preFunc) === 'function') { let retval = preFunc.apply(this, args); if (retval !== undefined) { return retval; } }
                    let retval = orgFunc.apply(this, arguments);
                    if (typeof(endFunc) === 'function') { let retval = endFunc.apply(this, args); if (retval !== undefined) { return retval; } }
                    return retval;
                };
            }
            obj[name].injectList = [injectId];
            Array.prototype.push.apply(obj[name].injectList, orgFunc.injectList);
        } catch(ex) { Components.utils.reportError("[ABH2] "+ex+"\n--- stack trace ---\n"+(new Error()).stack); }
    },

    get defaultInsertionIndex() {
        return (Preferences.get("extensions.abhere2.misc.insertTop", true) ? 0 : -1);
    },

    get isTagsInline() {
        return Preferences.get("extensions.abhere2.misc.tagsInline", true);
    },

    get panelWidth() {
        return Preferences.get("extensions.abhere2.bmProp.width", 350);
    },
    set panelWidth(value) {
        return Preferences.set("extensions.abhere2.bmProp.width", (value < 0 ? 0 : value));
    },

    trySortFolderByName: function(itemId) {
        let sortByName = PlacesUtils.annotations.itemHasAnnotation(itemId, 'abhere2/sortByName')
                      && PlacesUtils.annotations.getItemAnnotation(itemId, 'abhere2/sortByName');
        if (sortByName) {
            let txn = new PlacesSortFolderByNameTransaction(itemId);
            PlacesUtils.transactionManager.doTransaction(txn);
        }
    },

    init: function() {
        //===================================================
        //XXX: BookmarkPropertiesPanel :: content/browser/places/bookmarkProperties.js
        //===================================================

        //*** implement: support to create multi bookmark items without need a new folder as container
        BookmarkPropertiesPanel._getCreateNewBookmarksTransaction = function(aContainer, aIndex) {
            let transactions = [];
            if (this._tabInfos.length) {
                for (let i = 0; i < this._tabInfos.length; ++i) {
                    let uri = this._tabInfos[i].uri;
                    let title = this._tabInfos[i].title;
                    let tags = this._tabInfos[i].tags;
                    // add bookmark
                    transactions.push(new PlacesCreateBookmarkTransaction(uri, aContainer, aIndex, title));
                    // add tags
                    if (tags.length) {
                        transactions.push(new PlacesTagURITransaction(uri, tags));
                    }
                }
            }
            return new PlacesAggregatedTransaction("Create items childTxn", transactions);
        }

        BookmarkPropertiesPanel._getItemListForAggregateTransactions = function(aggregateTxn) {
            let transactions = aggregateTxn.childTransactions;
            let ids = [];
            let uris = [];
            if (transactions) {
                for (let i = 0; i < transactions.length; ++i) {
                    let uri = transactions[i].item.uri;
                    let id = PlacesUtils.getMostRecentBookmarkForURI(uri);
                    if (ids.indexOf(id) == -1) {
                        ids.push(id);
                        uris.push(uri);
                    }
                }
            }
            return { ids: ids, uris: uris };
        }

        abHere2.hackFunc(BookmarkPropertiesPanel, "_getDialogTitle", function(arguments) {
            if ((this._action == abHere2.ACTION_ADD) && (this._itemType == abHere2.BOOKMARK_ITEMS)) {
                return this._strings.getString("dialogTitleAddMulti");
            }
        });

        abHere2.hackFunc(BookmarkPropertiesPanel, "_getAcceptLabel", function(arguments) {
            if ((this._action == abHere2.ACTION_ADD) && (this._tabInfos)) {
                return this._strings.getString("dialogAcceptLabelAddMulti");
            }
        });

        abHere2.hackFunc(BookmarkPropertiesPanel, "_determineItemInfo", null, function(arguments) {
            if (this._action == abHere2.ACTION_ADD) {
                let dialogInfo = window.arguments[0];
                if (dialogInfo.type == "bookmarks") {
                    this._itemType = abHere2.BOOKMARK_ITEMS;
                    this._hiddenRows.push("name");
                    this._hiddenRows.push("location");
                    this._hiddenRows.push("keyword");
                    this._hiddenRows.push("description");
                    this._hiddenRows.push("loadInSidebar");
                    if (!Preferences.get("extensions.abhere2.starUI.row.tags", true)) { this._hiddenRows.push("tags"); }
                    if ("tabInfoList" in dialogInfo) { this._tabInfos = dialogInfo.tabInfoList; }
                }
                if (this._defaultInsertionPoint.itemId == PlacesUtils.bookmarksMenuFolderId) {
                    this._defaultInsertionPoint.index = abHere2.defaultInsertionIndex;
                }
            }
        });

        abHere2.hackFunc(BookmarkPropertiesPanel, "_promiseNewItem", function*(arguments) {
            if (this._itemType === abHere2.BOOKMARK_ITEMS) {
                let [container, index] = this._getInsertionPointDetails();
                let txn = this._getCreateNewBookmarksTransaction(container, index);

                PlacesUtils.transactionManager.doTransaction(txn);

                let { ids, uris } = this._getItemListForAggregateTransactions(txn);
                this._itemIDs = ids;
                this._itemURIs = uris;

                if (txn._promise) {
                    yield txn._promise;
                }

                let folderGuid = yield PlacesUtils.promiseItemGuid(container);
                let bm = yield PlacesUtils.bookmarks.fetch({
                    parentGuid: folderGuid,
                    index: index
                });

                this._itemId = yield PlacesUtils.promiseItemId(bm.guid);

                return Object.freeze({
                    itemId: this._itemId,
                    bookmarkGuid: bm.guid,
                    title: this._title,
                    uri: this._uri ? this._uri.spec : "",
                    type: this._itemType == abHere2.BOOKMARK_ITEM ?
                          Ci.nsINavHistoryResultNode.RESULT_TYPE_URI :
                          Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER
                });
            }
        });

        //*** implement: customize BookmarkPropertiesPanel UI
        abHere2.hackFunc(BookmarkPropertiesPanel, "onDialogLoad", function(arguments) {
            // customize BookmarkPropertiesPanel's width
            document.documentElement.width = abHere2.panelWidth;
            // group the tags in inline
            let tagsBox = document.getAnonymousNodes(document.getElementById("editBMPanel_tagsSelector"))[1].lastChild;
            tagsBox.style.display = (abHere2.isTagsInline ? "inline-block" : "");
        });

        //===================================================
        //XXX: gEditItemOverlay :: content/browser/places/editBookmarkOverlay.js
        //===================================================

        //*** implement: show selectionCount & tagsRow for BOOKMARK_ITEMS mode
        abHere2.hackFunc(gEditItemOverlay, "_setPaneInfo", null, function(arguments, aInitInfo) {
            if (this._paneInfo && (BookmarkPropertiesPanel._itemType == abHere2.BOOKMARK_ITEMS)) {
                this._paneInfo.bulkTagging = true;
                this._paneInfo.uris = BookmarkPropertiesPanel._itemURIs;
                return this._paneInfo;
            }
        });

        //*** implement: move multi items when user select a different folder
        gEditItemOverlay.moveItems = function(aItemIds, aNewContainer, aNewIndex) {
            let transactions = [];
            if (aItemIds) {
                for (let i = 0; i < aItemIds.length; ++i) {
                    transactions.push(new PlacesMoveItemTransaction(aItemIds[i], aNewContainer, aNewIndex));
                }
            }
            return new PlacesAggregatedTransaction("Move items childTxn", transactions);
        }
        abHere2.hackFunc(gEditItemOverlay, "onFolderMenuListCommand", function(arguments, aEvent) {
            if (aEvent.target.id == "editBMPanel_chooseFolderMenuItem") { return; }

            if (BookmarkPropertiesPanel._itemType == abHere2.BOOKMARK_ITEMS) {
                let containerId = this._getFolderIdFromMenuList();
                if ((PlacesUtils.bookmarks.getFolderIdForItem(this._paneInfo.itemId) != containerId) && (this._paneInfo.itemId != containerId)) {
                    let txn = this.moveItems(BookmarkPropertiesPanel._itemIDs || [this._paneInfo.itemId], containerId, abHere2.defaultInsertionIndex);
                    PlacesUtils.transactionManager.doTransaction(txn);
                    abHere2.trySortFolderByName(containerId);
                    return true;
                }
            }
        });

        //*** implement: ensureRowIsVisible when folderTree is expanded
        abHere2.hackFunc(gEditItemOverlay, "toggleFolderTreeVisibility", null, function(arguments) {
            this._folderTree.boxObject.ensureRowIsVisible(this._folderTree.view.selection.currentIndex);
        });

        //*** implement: create the new folder at user's insertionPoint
        abHere2.hackFunc(gEditItemOverlay, "newFolder", function(arguments) {
            let ipBookmarkPropsPanel = BookmarkPropertiesPanel._defaultInsertionPoint;
            let ipEditItemFolderTree = gEditItemOverlay._folderTree.insertionPoint;
            ipEditItemFolderTree.index = (ipEditItemFolderTree.itemId === ipBookmarkPropsPanel.itemId) ? ipBookmarkPropsPanel.index : abHere2.defaultInsertionIndex;
        });
    }
}
abHere2.init();
