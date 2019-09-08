Components.utils.import("resource://gre/modules/Preferences.jsm");
Components.utils.import("resource://gre/modules/Task.jsm");

var abHere2 = {
    strBundle: Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService)
                .createBundle('chrome://abhere2/locale/abhere2.properties'),

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

    get isInsertTop() {
        return Preferences.get("extensions.abhere2.misc.insertTop", true);
    },

    get isTagsInline() {
        return Preferences.get("extensions.abhere2.misc.tagsInline", true);
    },

    get isDuplicateAllowed() {
        return Preferences.get("extensions.abhere2.misc.duplicateAllowed", false);
    },

    get isTagsRowExpand() {
        return Preferences.get("extensions.abhere2.starUI.expand.tagsRow", true);
    },
    set isTagsRowExpand(value) {
        return Preferences.set("extensions.abhere2.starUI.expand.tagsRow", value);
    },

    get isFolderMenuListDisabled() {
        return Preferences.get("extensions.abhere2.starUI.disabled.folderMenuList", false);
    },

    get panelWidth() {
        return Preferences.get("extensions.abhere2.starUI.width", 350);
    },

    getBoxHeight: function(boxId) {
        return Preferences.get("extensions.abhere2.starUI.height."+boxId, 50);
    },

    setBoxHeight: function(boxId, height) {
        return Preferences.set("extensions.abhere2.starUI.height."+boxId, (height < 0 ? 0 : height));
    },

    getPrefFolderId: function(prefName, defaultId) {
        let folderId = Preferences.get(prefName, 0);
        folderId = (folderId ? Math.abs(folderId) : defaultId);
        function isFolderIdValid(aItemId) {
            try {
                return (PlacesUtils.bookmarks.getItemType(aItemId) == PlacesUtils.bookmarks.TYPE_FOLDER);
            } catch(e) {
                return false;
            }
        }
        return (isFolderIdValid(folderId) ? folderId : defaultId);
    },

    get prefBookmarkFolderId() {
        return abHere2.getPrefFolderId("extensions.abhere2.folderId.bookmark", PlacesUtils.bookmarksMenuFolderId);
    },
    set prefBookmarkFolderId(folderId) {
        if (Preferences.get("extensions.abhere2.folderId.bookmark", 0) < 0) return;
        Preferences.set("extensions.abhere2.folderId.bookmark", folderId);
    },

    get unsortedBookmarksFolderId() {
        return abHere2.getPrefFolderId("extensions.abhere2.folderId.unsorted", PlacesUtils.unfiledBookmarksFolderId);
    },
    set unsortedBookmarksFolderId(folderId) {
        if (Preferences.get("extensions.abhere2.folderId.unsorted", 0) < 0) return;
        Preferences.set("extensions.abhere2.folderId.unsorted", folderId);
    },

    get hiddenRows() {
        let aH = [];
        if (!Preferences.get("extensions.abhere2.starUI.row.name"         , true)) aH.push("'name'");
        if (!Preferences.get("extensions.abhere2.starUI.row.folderPicker" , true)) aH.push("'folderPicker'");
        if (!Preferences.get("extensions.abhere2.starUI.row.tags"         , true)) aH.push("'tags'");
        if (!Preferences.get("extensions.abhere2.starUI.row.description"  , true)) aH.push("'description'");
        if (!Preferences.get("extensions.abhere2.starUI.row.keyword"      , true)) aH.push("'keyword'");
        if (!Preferences.get("extensions.abhere2.starUI.row.location"     , true)) aH.push("'location'");
        if (!Preferences.get("extensions.abhere2.starUI.row.loadInSidebar", true)) aH.push("'loadInSidebar'");
        if (!Preferences.get("extensions.abhere2.starUI.row.feedLocation" , true)) aH.push("'feedLocation'");
        if (!Preferences.get("extensions.abhere2.starUI.row.siteLocation" , true)) aH.push("'siteLocation'");
        return "[" + aH.join(",") + "]";
    },

    get1stElementByAttribute: function(target, name, value) {
        for (let i = 0; i < target.childNodes.length; i++) {
            let elmt = target.childNodes[i];
            if (elmt.hasAttribute(name)) {
                let sep = (name=="class" ? "|\\s+" : "");
                let re = new RegExp("(^"+sep+")"+value+"($"+sep+")");
                if (re.test(elmt.getAttribute(name))) return elmt;
            }
        }
        return null;
    },

    get1stElementHasOwnProperty: function(target, name) {
        for (let i = 0; i < target.childNodes.length; i++) {
            let elmt = target.childNodes[i];
            if (elmt.hasOwnProperty(name)) {
                return elmt;
            }
        }
        return null;
    },

    getAnchorElementByItemId: function(target, itemId) {
        let container = ["menuitem", "menu", "toolbarbutton"].indexOf(target.tagName) != -1 ? target.parentNode : target;
        for (let i = 0; i < container.childNodes.length; i++) {
            let elmt = container.childNodes[i];
            if (elmt._placesNode && (elmt._placesNode.itemId == itemId)) {
                return elmt;
            }
        }
        return target;
    },

    closePopups: function(elmt) {
        while (elmt) {
            if (elmt.hidePopup) elmt.hidePopup();
            elmt = elmt.parentNode;
        }
    },

    getPopupOwnerElement: function(elmt) {
        let exists = { "menupopup": true, "popup": true };
        while (elmt && elmt.parentNode) {
            if (!exists[elmt.tagName] && !exists[elmt.parentNode.tagName]) break;
            elmt = elmt.parentNode;
        }
        return elmt;
    },

    getInsertionPoint: function(aNode, forceInsideFolder) {
        let ip;
        if (aNode) {
            let isContainer = PlacesUtils.nodeIsFolder(aNode) || PlacesUtils.nodeIsQuery(aNode);
            if (isContainer && forceInsideFolder) {
                ip = { node: aNode,
                        index: (abHere2.isInsertTop ? 0 : -1) };
            } else {
                ip = { node: aNode.parent || aNode, //XXX: aNode.parent = null: when right click on bookmarks toolbar space
                        index: aNode.bookmarkIndex };
            }
        }
        return ip;
    },

    getInsertionPointDetails: function(target) {
        let ip;
        switch(target.ownerDocument.documentElement.id)
        {
            case "bookmarksPanel":
                let tree = target.ownerDocument.getElementsByTagName("tree")[0];
                ip = abHere2.getInsertionPoint(tree.selectedNode, true);
                if (ip) ip.anchor = tree;
                break;

            case "main-window":
                let owner = abHere2.getPopupOwnerElement(target);
                if ((owner.id == "mainPopupSet") && (document.popupNode instanceof XULElement)) {
                    // click ABH from context menu
                    target = document.popupNode;
                    let _insideFolder = Preferences.get("extensions.abhere2.folder.insideFolder", false);
                    ip = abHere2.getInsertionPoint(target._placesNode, _insideFolder);
                } else {
                    // click ABH from menu
                    ip = { node: target._placesNode, index: (abHere2.isInsertTop ? 0 : -1) };
                }
                if (ip) ip.anchor = abHere2.getPopupOwnerElement(target);
                break;
        }
        return ip;
    },

    getTagByFolderNode: function(aNode) {
        let s = PlacesUtils.bookmarks.getItemTitle(PlacesUtils.getConcreteItemId(aNode));
        // remove the ASCII special chars. http://ascii-table.com/
        s = s.replace(/^[\s\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]*/,"").replace(/[\s\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]*$/,"");
        return s.length ? [s] : [];
    },

    clickBookmarkHere: Task.async(function*(event) {
        if (event.which == 1) return; // event.which = [ 0: oncommand | 1: onclick(left) | 2: onclick(middle) | 3: onclick(right) ]
        if (!event.originalTarget) return;

        // click on ABH menuitem ?
        let isABH = event.originalTarget.classList.contains("abhere-menuitem");

        // get target node
        let target = isABH ? (event.originalTarget.parentNode || event.originalTarget._parentNode) : event.originalTarget;
        if (!target) return;

        // get insertionPoint details
        let ip = abHere2.getInsertionPointDetails(target);
        let aNode = ip.node;
        let aIndex = ip.index;
        let aAnchor = ip.anchor;
        let aItemId = PlacesUtils.getConcreteItemId(ip.node);

        // close all popup menus
        abHere2.closePopups(document.popupNode);
        abHere2.closePopups(event.originalTarget);

        // implement autoTagFolder feature
        let _autoTagFolder = (!PlacesUtils.isRootItem(aItemId)) && Preferences.get("extensions.abhere2.folder.autoTagFolder", false);
        let aTags = (_autoTagFolder || PlacesUtils.nodeIsTagQuery(aNode)) ? abHere2.getTagByFolderNode(aNode) : [];

        // if click on a tag folder, redirect to unsortedBookmarkFolder
        if (PlacesUtils.nodeIsTagQuery(aNode)) {
            aItemId = abHere2.unsortedBookmarksFolderId;
            aIndex = (abHere2.isInsertTop ? 0 : -1);
        }

        // check if url is already bookmarked
        let aBrowser = getBrowser().selectedBrowser;
        let isBookmarked = (PlacesUtils.getMostRecentBookmarkForURI(aBrowser.currentURI) != -1);
        // if duplicate bookmark is allowed, force to unset isBookmarked flag
        if (abHere2.isDuplicateAllowed) { isBookmarked = false; }

        // keep insert position
        abHere2.aIndex = aIndex;
        abHere2.aAnchor = aAnchor;
        abHere2.aItemId = aItemId;
        abHere2.isBookmarked = isBookmarked;

        // ready to implement the clicking feature
        let button = (event.button ? event.button : 0);
        let action = isABH ?
                     Preferences.get("extensions.abhere2.clicking."+["left","middle","right"][button], button) :
                     Preferences.get("extensions.abhere2.folder.middleClick", 0) - 1;

        switch(action) {
        case 0: // show EditBookmarkUI
            abHere2.isDupBmkAllowed = abHere2.isDuplicateAllowed;
            yield PlacesCommandHook.bookmarkPage(aBrowser, aItemId, true, aIndex);
            abHere2.isDupBmkAllowed = false;
            if (aTags.length) abHere2.tagURIs([aBrowser.currentURI], aTags);
            break;
        case 1: // without EditBookmarkUI
            abHere2.isDupBmkAllowed = abHere2.isDuplicateAllowed;
            yield PlacesCommandHook.bookmarkPage(aBrowser, aItemId, isBookmarked, aIndex);
            abHere2.isDupBmkAllowed = false;
            if (aTags.length) abHere2.tagURIs([aBrowser.currentURI], aTags);
            if (PlacesUtils.nodeIsFolder(aNode) && !isBookmarked) abHere2.saveBookmarkFolderId(aItemId);
            break;
        case 2: // show AddMultiBookmarkUI
            let aTabInfoList = abHere2.getUniqueTabInfo(aTags);
            let aInsertionPoint = new InsertionPoint(aItemId, aIndex);
            let info = {
                action: "add",
                type: "bookmarks",
                hiddenRows: [],
                defaultInsertionPoint: aInsertionPoint,
                tabInfoList: aTabInfoList
            };
            PlacesUIUtils.showBookmarkDialog(info, window, true);
            break;
        }

        event.preventDefault();

        // reset insert position
        delete abHere2.aIndex;
        delete abHere2.aAnchor;
        delete abHere2.aItemId;
        delete abHere2.isBookmarked;
    }),

    handleMiddleClickFolder: function(event) {
        if (event.button != 1) return false;
        if (Preferences.get("extensions.abhere2.folder.middleClick", 0) == 0) return false;
        abHere2.clickBookmarkHere(event);
        return true;
    },

    tagURIs: function(aURIList, aTags) {
        for (let i = 0; i < aURIList.length; i++) {
            let txn = new PlacesTagURITransaction(aURIList[i], aTags);
            PlacesUtils.transactionManager.doTransaction(txn);
        }
    },

    get placeContextSortByNameChecked() {
        let elmt = document.getElementById("placesContext_sortBy:name");
        return elmt ? (elmt.getAttribute('checked') ? true : false) : null;
    },
    set placeContextSortByNameChecked(checked) {
        let elmt = document.getElementById("placesContext_sortBy:name");
        if (elmt) elmt.setAttribute('checked', checked ? true : false);
    },

    getAnnoIsFolderSortByName: function(itemId) {
        return PlacesUtils.annotations.itemHasAnnotation(itemId, 'abhere2/sortByName')
            && PlacesUtils.annotations.getItemAnnotation(itemId, 'abhere2/sortByName');
    },
    setAnnoIsFolderSortByName: function(itemId, isSortByName) {
        if (isSortByName) {
            PlacesUtils.annotations.setItemAnnotation(itemId, 'abhere2/sortByName', true, 0, Ci.nsIAnnotationService.EXPIRE_NEVER);
        } else {
            PlacesUtils.annotations.removeItemAnnotation(itemId, 'abhere2/sortByName');
        }
    },

    nodeIsReadOnly: function(node) {
        return PlacesUtils.nodeIsFolder(node) && PlacesUIUtils.isContentsReadOnly && PlacesUIUtils.isContentsReadOnly(node);
    },

    trySortFolderByName: function(itemId) {
        if (itemId) {
            let sorted = abHere2.getAnnoIsFolderSortByName(itemId);
            if (sorted) {
                let txn = new PlacesSortFolderByNameTransaction(itemId);
                PlacesUtils.transactionManager.doTransaction(txn);
            }
        }
    },

    getUniqueTabInfo: function(aTags) {
        let tabList = [];
        let seenURIs = [];

        let _ignorePinnedTabs = Preferences.get("extensions.abhere2.misc.ignorePinned", true);
        let tabs = getBrowser().tabContainer.childNodes;
        for (let i = 0; i < tabs.length; i++) {
            if (tabs[i].hidden) continue;
            if (_ignorePinnedTabs && tabs[i].pinned) continue;
            let aBrowser = tabs[i].linkedBrowser;
            let uri = aBrowser.currentURI;
            let title = aBrowser.contentTitle || uri.spec;

            if (uri.spec in seenURIs) continue;
            seenURIs[uri.spec] = true;

            if (abHere2.isInsertTop) {
                tabList.unshift({ uri:uri, title:title, tags:aTags });
            } else {
                tabList.push({ uri:uri, title:title, tags:aTags });
            }
        }
        return tabList;
    },

    moveOpTabsAndHomePageItems: function(target) {
        let sprtor = target._endOptSeparator;
        let ophome = target._endOptOpenSiteURI;
        let optabs = target._endOptOpenAllInTabs;

        if (sprtor) target.removeChild(sprtor);
        if (ophome) target.removeChild(ophome);
        if (optabs) target.removeChild(optabs);

        let cc = target._placesNode.childCount;
        let _hideOptabs = (cc < 2) || (optabs == null) || (optabs && (Preferences.get("extensions.abhere2.position.optabs", 2) == 0));
        let _hideOphome = (cc < 2) || (ophome == null) || (ophome && (Preferences.get("extensions.abhere2.position.ophome", 2) == 0));
        if (optabs) optabs.collapsed = _hideOptabs;
        if (ophome) ophome.collapsed = _hideOphome;
        if (sprtor) sprtor.collapsed = (_hideOptabs && _hideOphome);

        let _top = (Preferences.get("extensions.abhere2.position.optabs", 2) == 1);
        if (sprtor) sprtor.setAttribute("builder", _top ? "start" : "end");
        if (sprtor) target.insertBefore(sprtor, _top ? target.firstChild : null);
        if (ophome) target.insertBefore(ophome, _top ? target.firstChild : null);
        if (optabs) target.insertBefore(optabs, _top ? target.firstChild : null);
    },

    createAddBookmarkHereItems: function(target) {
        let node = target._placesNode;
        if (!node) return;
        if (!PlacesUtils.nodeIsFolder(node) && !PlacesUtils.nodeIsTagQuery(node)) return;
        if (abHere2.nodeIsReadOnly(node)) return;

        let abhere = abHere2.get1stElementByAttribute(target, "class", "abhere-menuitem");
        let sprtor = abHere2.get1stElementByAttribute(target, "class", "abhere-separator");

        if (abhere) target.removeChild(abhere);
        else {
            abhere = document.createElement("menuitem");
            abhere.setAttribute("label", abHere2.strBundle.GetStringFromName("label"));
            //abhere.setAttribute("accesskey", abHere2.strBundle.GetStringFromName("accesskey"));
            abhere.setAttribute("class", "abhere-menuitem");
            abhere.addEventListener("click", abHere2.clickBookmarkHere, false);
            abhere.addEventListener("command", abHere2.clickBookmarkHere, false);
        }
        if (sprtor) target.removeChild(sprtor);
        else {
            sprtor = document.createElement("menuseparator");
            sprtor.setAttribute("class", "abhere-separator");
        }

        if (abhere && Preferences.get("extensions.abhere2.misc.showIconic", true)) {
            abhere.classList.toggle("menuitem-iconic", true);
            abhere.classList.toggle("subviewbutton", target.parentNode.classList.contains("subviewbutton"));
        } else {
            abhere.classList.remove("menuitem-iconic");
            abhere.classList.remove("subviewbutton");
        }

        let _hideAbhere = (abhere == null) || (abhere && (Preferences.get("extensions.abhere2.position.abhere", 1) == 0));
        if (abhere) abhere.collapsed = _hideAbhere;
        if (sprtor) sprtor.collapsed = _hideAbhere;

        let _top = (Preferences.get("extensions.abhere2.position.abhere", 1) == 1);
        if (sprtor) sprtor.setAttribute("builder", _top ? "start" : "end");
        if (sprtor) target.insertBefore(sprtor, _top ? target.firstChild : null);
        if (abhere) target.insertBefore(abhere, _top ? target.firstChild : null);
        if (abhere) abhere._parentNode = target;
    },

    controlBookmarksMenuPopups: function(target) {
        let bmcurpage = abHere2.get1stElementByAttribute(target, "key", "addBookmarkAsKb");
        if (bmcurpage) bmcurpage.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.bmcurpage", true);

        let bmalltabs = abHere2.get1stElementByAttribute(target, "key", "bookmarkAllTabsKb");
        if (bmalltabs) bmalltabs.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.bmalltabs", true);

        let showallbm = abHere2.get1stElementByAttribute(target, "key", "manBookmarkKb");
        if (showallbm) showallbm.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.showallbm", true);

        let sbsc2item = abHere2.get1stElementByAttribute(target, "observes", "singleFeedMenuitemState");
        if (sbsc2item) sbsc2item.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.subscribe", true);

        let sbsc2menu = abHere2.get1stElementByAttribute(target, "observes", "multipleFeedsMenuState");
        if (sbsc2menu) sbsc2menu.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.subscribe", true);

        let viewbtbar = abHere2.get1stElementByAttribute(target, "id", "BMB_viewBookmarksToolbar");
        if (viewbtbar) viewbtbar.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.viewbtbar", true);

        let viewbsbar = abHere2.get1stElementByAttribute(target, "id", "BMB_viewBookmarksSidebar");
        if (viewbsbar) viewbsbar.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.viewbsbar", true);

        let viewpockt = abHere2.get1stElementByAttribute(target, "id", "BMB_pocket") || abHere2.get1stElementByAttribute(target, "id", "menu_pocket");
        if (viewpockt) viewpockt.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.viewpockt", true);

        let bmtoolbar = abHere2.get1stElementByAttribute(target, "id", "BMB_bookmarksToolbar") || abHere2.get1stElementByAttribute(target, "id", "bookmarksToolbarFolderMenu");
        if (bmtoolbar) bmtoolbar.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.bmtoolbar", true);

        let unsrtmenu = abHere2.get1stElementByAttribute(target, "id", "BMB_unsortedBookmarks") || abHere2.get1stElementByAttribute(target, "id", "menu_unsortedBookmarks");
        if (unsrtmenu) unsrtmenu.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.unsrtmenu", true);

        let unsrtmsep = abHere2.get1stElementByAttribute(target, "class", "hide-if-empty-places-result");
        if (unsrtmsep) unsrtmsep.collapsed = !Preferences.get("extensions.abhere2.bmsmenu.unsrtmenu", true);

        // cleanup abhere menuitem/separator
        let addbmhere = abHere2.get1stElementByAttribute(target, "class", "abhere-menuitem");
        let addsprtor = abHere2.get1stElementByAttribute(target, "class", "abhere-separator");
        if (addbmhere) { addbmhere.remove(); }
        if (addsprtor) { addsprtor.remove(); }

        // create abhere-menuitem
        let _icon = Preferences.get("extensions.abhere2.misc.showIconic", true);
        let _tbtn = (target.parentNode.tagName === 'toolbarbutton');
        addbmhere = document.createElement("menuitem");
        addbmhere.setAttribute("label", abHere2.strBundle.GetStringFromName("label"));
        addbmhere.setAttribute("accesskey", abHere2.strBundle.GetStringFromName("accesskey"));
        addbmhere.setAttribute("class", "abhere-menuitem"+(_icon ? " menuitem-iconic" : "")+(_tbtn ? " subviewbutton" : ""));
        addbmhere.addEventListener("click", abHere2.clickBookmarkHere, false);
        addbmhere.addEventListener("command", abHere2.clickBookmarkHere, false);
        target.insertBefore(addbmhere, target._startMarker);
        addbmhere._parentNode = target;
        // create abhere-separator
        addsprtor = document.createElement("menuseparator");
        addsprtor.setAttribute("class", "abhere-separator");
        target.insertBefore(addsprtor, target._startMarker);

        // display abhere menuitem or not
        addbmhere.hidden = !Preferences.get("extensions.abhere2.bmsmenu.addbmhere", false);
        addsprtor.hidden = !Preferences.get("extensions.abhere2.bmsmenu.addbmhere", false);

        // hide unnecessary menuseparators
        let collapsed = true;
        for (let i = 0; i < target.childNodes.length; i++) {
            let elmt = target.childNodes[i];
            if (elmt._placesNode) break;
            if (elmt.tagName === "menuseparator") {
                elmt.hidden = false;
                elmt.collapsed = collapsed;
                collapsed = true;
            } else {
                collapsed = collapsed && (elmt.collapsed || elmt.hidden || (window.getComputedStyle(elmt).display === 'none'));
            }
        }
    },

    onpopupBookmarksMenu: function(event) {
        let target = event.originalTarget;
        let node = target._placesNode;
        switch (node ? node.uri : "") {
            case "":
            case "place:folder=BOOKMARKS_MENU":
                //*** control hidden/show of BookmarksMenu's menuitems
                abHere2.controlBookmarksMenuPopups(target);
                break;
            case "place:folder=TOOLBAR":
                if (target.parentNode.classList.contains("chevron")) break;
            default:
                let _top = (Preferences.get("extensions.abhere2.position.abhere", 1) == 1);
                if (_top) {
                    abHere2.moveOpTabsAndHomePageItems(target);
                    abHere2.createAddBookmarkHereItems(target);
                } else {
                    abHere2.createAddBookmarkHereItems(target);
                    abHere2.moveOpTabsAndHomePageItems(target);
                }
        }
    },

    onpopupBookmarksContextMenu: function(event) {
        if (event.originalTarget.id != "placesContext") return;
        let ip = abHere2.getInsertionPointDetails(event.originalTarget);
        let isEnabled = Preferences.get("extensions.abhere2.context.addbmhere", true);
        if (isEnabled && ip && ip.node && !abHere2.nodeIsReadOnly(ip.node)) {
            let _icon = Preferences.get("extensions.abhere2.misc.showIconic", true);
            let bmNew = event.originalTarget.ownerDocument.getElementById("placesContext_new:bookmark");
            let bmABH = document.createElement("menuitem");
            bmABH.setAttribute("id", "placesContext_new:addbookmarkhere");
            bmABH.setAttribute("label", abHere2.strBundle.GetStringFromName("label"));
            bmABH.setAttribute("accesskey", abHere2.strBundle.GetStringFromName("accesskey"));
            bmABH.setAttribute("class", (_icon ? "menuitem-iconic " : "") + "abhere-menuitem");
            bmABH.addEventListener("click", window.top.abHere2.clickBookmarkHere, false);
            bmABH.addEventListener("command", window.top.abHere2.clickBookmarkHere, false);
            event.originalTarget.insertBefore(bmABH, bmNew);
            bmABH._parentNode = event.originalTarget;
        }
        // update "placesContext_sortBy:name" menuitem's checked status
        let node = event.originalTarget.ownerDocument.popupNode._placesNode || ip && ip.node;
        if (node && PlacesUtils.nodeIsFolder(node)) {
            let itemId = PlacesUtils.getConcreteItemId(node);
            let checked = abHere2.getAnnoIsFolderSortByName(itemId) ? true : false;
            let elmt = abHere2.get1stElementByAttribute(event.originalTarget, 'id', 'placesContext_sortBy:name');
            if (elmt) elmt.setAttribute('checked', checked);
        }
    },

    oncloseBookmarksContextMenu: function(event) {
        if (event.originalTarget.id != "placesContext") return;
        let bmABH = event.originalTarget.ownerDocument.getElementById("placesContext_new:addbookmarkhere");
        if (bmABH) event.originalTarget.removeChild(bmABH);
    },

    saveBookmarkFolderId: function(folderId) {
        abHere2.prefBookmarkFolderId = folderId;
    },

    expandRow: function(aRow) {
        aRow.nextSibling.collapsed = false;
        let expander = aRow.getElementsByTagName("button")[0];
        if (expander) {
            expander.className = "expander-up";
            expander.setAttribute("tooltiptext", expander.getAttribute("tooltiptextup"));
        }
    },

    expandRows: function() {
        if (!StarUI.anchorIsPlacesNode && Preferences.get("extensions.abhere2.starUI.expand.folderRow", true)) {
            let aRow = document.getElementById("editBMPanel_folderRow");
            if (aRow) {
                abHere2.expandRow(aRow);
                document.getElementById("editBMPanel_newFolderBox").collapsed = false;
                document.getElementById("editBMPanel_chooseFolderSeparator").hidden = document.getElementById("editBMPanel_chooseFolderMenuItem").hidden = true;
                const FOLDER_TREE_PLACE_URI = "place:excludeItems=1&excludeQueries=1&excludeReadOnlyFolders=1&folder="+PlacesUIUtils.allBookmarksFolderId;
                gEditItemOverlay._folderTree.place = FOLDER_TREE_PLACE_URI;
                setTimeout(function() {
                    if (StarUI._itemId != -1) {
                        gEditItemOverlay._folderTree.place = FOLDER_TREE_PLACE_URI;
                        gEditItemOverlay._folderTree.selectItems([PlacesUtils.bookmarks.getFolderIdForItem(StarUI._itemId)]);
                        gEditItemOverlay._folderTree.boxObject.ensureRowIsVisible(gEditItemOverlay._folderTree.view.selection.currentIndex);
                    }
                }, 250);
            }
        }
        if (Preferences.get("extensions.abhere2.starUI.expand.tagsRow", true)) {
            let aRow = document.getElementById("editBMPanel_tagsRow");
            if (aRow) {
                abHere2.expandRow(aRow);
                gEditItemOverlay._rebuildTagsSelectorList();
                aRow.nextSibling.addEventListener("CheckboxStateChange", gEditItemOverlay, false);
            }
        }
    },

    correctRemoveButtonCount: function(aURI) {
        let itemIds = PlacesUtils.getBookmarksForURI(aURI);
        let forms = gNavigatorBundle.getString("editBookmark.removeBookmarks.label");
        let label = PluralForm.get(itemIds.length, forms).replace("#1", itemIds.length);
        document.getElementById("editBookmarkPanelRemoveButton").label = label;
    },

    removeBookmarksForCurrentPage: function() {
        let itemIds = PlacesUtils.getBookmarksForURI(gBrowser.currentURI);
        for (let i = 0; i < itemIds.length; i++) {
            let txn = new PlacesRemoveItemTransaction(itemIds[i]);
            PlacesUtils.transactionManager.doTransaction(txn);
        }
    },

    handleStarButtonClick: function(event) {
        // accept only event from the "star" button
        if (!event.originalTarget.hasAttribute("anonid")) return false;

        // use event.button value to decide action type
        let button = (event.button ? event.button : 0);
        let action = Preferences.get("extensions.abhere2.starUI.clicking."+["left","middle","right"][button], 0);
        if (action & 8) {
            switch (action) {
                case 8: // open the ABH2 options dialog
                    window.openDialog("chrome://abhere2/content/prefsDialog.xul", "abHere2Prefs", "chrome,centerscreen,dependent,toolbar");
                    return true;
                case 9: // open the Library window
                    PlacesCommandHook.showPlacesOrganizer('AllBookmarks');
                    return true;
            }
        } else {
            let target = event.currentTarget.hasAttribute("anonid") ? event.currentTarget.parentNode : event.currentTarget;
            let isStarred = (target.getAttribute("starred") == "true");
            if (action & 1) { // do remove all bookmarks for current URI
                if (isStarred) {
                    abHere2.removeBookmarksForCurrentPage();
                    return true;
                }
            }
            if (action & 2) { // do bookmark current page to the unsorted bookmarks folder
                if (!isStarred) {
                    BookmarkingUI._showBookmarkedNotification();
                }
                PlacesCommandHook.bookmarkCurrentPage(isStarred);
                return true;
            }
            if (action & 4) { // do bookmark current page with a single click
                if (!isStarred) {
                    BookmarkingUI._showBookmarkedNotification();
                }
                PlacesCommandHook.bookmarkCurrentPage(true, abHere2.prefBookmarkFolderId);
                return true;
            }
        }
        return false;
    },

    onpopupToolbarContextMenu: function(event) {
        if (event.originalTarget.id != "toolbar-context-menu") return;
        // prevent context menu popup if user assigned action to star-button's right-click event
        if (document.popupNode.id == "star-button") {
            let action = Preferences.get("extensions.abhere2.starUI.clicking.right", 0);
            if (action) event.preventDefault();
        }
    },

    createResizer: function(aBoxId) {
        let id = "editBMPanel_"+aBoxId+"Resizer";
        let resizer = document.getElementById(id);
        if (resizer) return;

        resizer = document.createElement("resizer");
        resizer.setAttribute("class", "resizer");
        resizer.id = id;
        resizer.height = "3";
        resizer.dir = "bottom";
        resizer.element = "editBMPanel_"+aBoxId;

        let box = document.getElementById("editBMPanel_"+aBoxId);
        if (box.parentNode.tagName != "vbox") {
            box.parentNode.insertBefore(document.createElement("vbox"), box).appendChild(box);
        }
        box.parentNode.insertBefore(resizer, box.nextSibling);
        box.removeAttribute('align');
        box.removeAttribute('minheight');
        box.height = abHere2.getBoxHeight(aBoxId);
        box.setAttribute('flex', 0);
        box.parentNode.setAttribute('flex', 0);
        box.parentNode.parentNode.setAttribute('flex', 0);

        let panel = document.getElementById("editBookmarkPanel");
        panel.addEventListener("mousedown", function(e) {
            if (e.target == resizer) {
                panel.setAttribute('height', panel.boxObject.height);
                box.removeAttribute('height');
                box.setAttribute('flex', 1);
                box.parentNode.setAttribute('flex', 1);
                box.parentNode.parentNode.setAttribute('flex', 1);
                box.isDrag = true;
            }
        }, false);
        panel.addEventListener("mouseup", function(e) {
            if (box.isDrag && (e.target == resizer)) {
                box.isDrag = false;
                abHere2.setBoxHeight(aBoxId, box.height = box.boxObject.height);
                box.setAttribute('flex', 0);
                box.parentNode.setAttribute('flex', 0);
                box.parentNode.parentNode.setAttribute('flex', 0);
                panel.removeAttribute('height');
            }
        }, false);
    },

    getDescriptionFromSelectionText: function() {
        let selectionText = "";
        try {
            if (Preferences.get("extensions.abhere2.starUI.row.description", true)) {
                let win = Services.wm.getMostRecentWindow("navigator:browser");
                let selectionInfo = BrowserUtils.getSelectionDetails(win);
                if (selectionInfo) {
                    let maxLength = Preferences.get("extensions.abhere2.starUI.row.description.maxLength", 150);
                    selectionText = selectionInfo.text.trim().substring(0, maxLength);
                }
            }
        } catch(ex) {}
        return selectionText;
    },

    bookmarkLink: function() {
        let uri = Services.io.newURI(this.linkURL, null, null);
        let itemId = PlacesUtils.getMostRecentBookmarkForURI(uri);
        let isNewBookmark = (itemId == -1);
        if (isNewBookmark) {
            StarUI.beginBatch();
            let parent = abHere2.prefBookmarkFolderId;
            let index = (abHere2.isInsertTop ? 0 : -1);
            let title = this.linkTextStr;
            let txn = new PlacesCreateBookmarkTransaction(uri, parent, index, title);
            PlacesUtils.transactionManager.doTransaction(txn);
            itemId = txn.item.id;
        }
        StarUI.showEditBookmarkPopup(itemId, gContextMenu.target, "");
        return true;
    },

    getBookmarksPathListForURI: function(uri, crumb = ' » ') {
        let itemIds = PlacesUtils.getBookmarksForURI(uri);
        let itemPaths = [];
        for (let i = 0; i < itemIds.length; i++) {
            let itemId = itemIds[i];
            let itemTitles = [];
            while (itemId = PlacesUtils.bookmarks.getFolderIdForItem(itemId)) {
                if (itemId == PlacesUtils.placesRootId) break;
                itemTitles.unshift(PlacesUtils.bookmarks.getItemTitle(itemId));
            }
            itemPaths.push(itemTitles.join(crumb));
        }
        return itemPaths;
    },

    onpopupStarButtonTooltips: function(event) {
        let tooltips = BookmarkingUI._starredTooltip;
        let paths = abHere2.getBookmarksPathListForURI(gBrowser.currentURI);
        if (paths.length > 0) {
            tooltips += '\n➥ '+ paths.join('\n➠ ');
        }
        BookmarkingUI.broadcaster.setAttribute('buttontooltiptext', tooltips);
    },

    init: function() {

        //*** implement "fill selected text in description" feature
        abHere2.hackFunc(PlacesUIUtils, "getDescriptionFromDocument", function(arguments) {
            let description = abHere2.getDescriptionFromSelectionText();
            if (description) { return description; }
        });

        //*** fix failed to assign textbox value on initial
        abHere2.hackFunc(gEditItemOverlay, "_initTextField", function(arguments, aElement, aValue) {
            if (aElement.value != aValue) {
                aElement.setAttribute("value", aValue);
            }
        });

        //*** implement sortFolderByName feature
        //when check/uncheck the folder's sortByName menuitem, save the checked status using nsIAnnotationService
        abHere2.hackFunc(PlacesController.prototype, "doCommand", function(arguments, aCommand) {
            if (aCommand == "placesCmd_sortBy:name") {
                let itemId = PlacesUtils.getConcreteItemId(this._view.selectedNode);
                let checked = abHere2.placeContextSortByNameChecked;
                abHere2.setAnnoIsFolderSortByName(itemId, checked);
                if (!checked) { return true; }
            }
        });

        //if folder's sortByName is checked, sort folder by name after bookmark a page
        abHere2.hackFunc(PlacesCommandHook, "bookmarkPage", null, function(arguments, aBrowser, aParent, aShowEditUI) {
            abHere2.trySortFolderByName(aParent);
        });

        //*** implement insertTop feature
        //decide insert position when user bookmark a page
        abHere2.hackFunc(PlacesCreateBookmarkTransaction.prototype, "doTransaction", function(arguments) {
            this.item.index = !isNaN(abHere2.aIndex) ? abHere2.aIndex : (this.item.index == -1 ? (abHere2.isInsertTop ? 0 : -1) : this.item.index);
        });

        //decide insert position when user move a bookmark
        abHere2.hackFunc(PlacesMoveItemTransaction.prototype, "doTransaction", function(arguments) {
            this.new.index = !isNaN(abHere2.aIndex) ? abHere2.aIndex : (this.new.index == -1 ? (abHere2.isInsertTop ? 0 : -1) : this.new.index);
        });

        //decide insert position when user select folder on editBookmark UI
        abHere2.hackFunc(gEditItemOverlay, "onFolderMenuListCommand", null, function(arguments) {
            let containerId = this._getFolderIdFromMenuList();
            abHere2.trySortFolderByName(containerId);
        });

        //decide insert position when user click newFolder on editBookmark UI
        abHere2.hackFunc(gEditItemOverlay, "newFolder", function(arguments) {
            let ip = gEditItemOverlay._folderTree.insertionPoint;
            if (ip) { ip.index = (abHere2.isInsertTop ? 0 : -1); }
        });

        //decide insert position when user drop a bookmark or folder
        abHere2.hackFunc(PlacesControllerDragHelper, "onDrop", function(arguments, ip, dt) {
            if (ip.orientation == Ci.nsITreeView.DROP_ON) {
                if (abHere2.isInsertTop) { ip.index = 0; }
            }
        }, function(arguments, ip, dt) {
            abHere2.trySortFolderByName(ip.itemId);
        });

        //bookmarkAllTabs into folder, keep tabs always saved from left to right.
        abHere2.hackFunc(PlacesUIUtils, "showBookmarkDialog", function(arguments, aInfo) {
            if (aInfo.URIList && (aInfo.type === "folder") && abHere2.isInsertTop) {
                aInfo.URIList.reverse();
            }
        });

        //*** implement "edit bookmark properties using StarUI" feature
        abHere2.hackFunc(PlacesUIUtils, "showBookmarkDialog", function(arguments, aInfo, aParentWindow) {
            if (!Preferences.get("extensions.abhere2.context.newpropui", false)) return;
            if (aInfo && (aInfo.action === "edit") && aInfo.node && PlacesUtils.nodeIsBookmark(aInfo.node)) {
                let itemId = aInfo.node.itemId;
                let popupOwner = abHere2.getPopupOwnerElement(document.popupNode) || aParentWindow.getBrowser();
                let anchorNode = abHere2.getAnchorElementByItemId(popupOwner, itemId);
                aParentWindow.StarUI.showEditBookmarkPopup(itemId, anchorNode, "after_pointer");
                return true;
            }
        });

        //*** implement anchorPopup feature
        //decide bookmarkEditor popup position
        abHere2.hackFunc(StarUI, "showEditBookmarkPopup", function(arguments, aItemId, aAnchorElement, aPosition) {
            let isPlacesNode = abHere2.aAnchor && abHere2.aAnchor._placesNode;
            let isTagsFolder = isPlacesNode && PlacesUtils.nodeIsTagQuery(abHere2.aAnchor._placesNode);
            let isSameFolder = isPlacesNode && (abHere2.aItemId === abHere2.aAnchor._placesNode.itemId);
            let isNewBookmark = abHere2.aAnchor && !abHere2.isBookmarked;
            if (isNewBookmark && (abHere2.aAnchor.tagName === "tree")) {
                arguments[1] = abHere2.getAnchorElementByItemId(abHere2.aAnchor, abHere2.aItemId);
                arguments[2] = "end_before";
            } else if (isNewBookmark || isTagsFolder) {
                arguments[1] = abHere2.getAnchorElementByItemId(abHere2.aAnchor, abHere2.aItemId);
                arguments[2] = (isSameFolder || isTagsFolder) ? "" : "after_pointer";
            } else if (aAnchorElement && (aAnchorElement.id == "identity-icon")) {
                arguments[1] = aAnchorElement;
                arguments[2] = "";
            } else if (!aAnchorElement || (aAnchorElement === gBrowser.selectedBrowser)) {
                aAnchorElement = document.getElementById("bookmarks-menu-button");
                aAnchorElement = aAnchorElement && document.getAnonymousElementByAttribute(aAnchorElement, "anonid", "dropmarker");
                aAnchorElement = isElementVisible(aAnchorElement) ? aAnchorElement : document.getElementById("PanelUI-menu-button");
                arguments[1] = aAnchorElement;
                arguments[2] = "bottomcenter topright";
            }
        });

        //*** fix display problem on PlacesViewBase.prototype.nodeInserted()
        abHere2.hackFunc(Object.getPrototypeOf(PlacesPanelview), "nodeInserted", null, function(arguments, aParentPlacesNode, aPlacesNode, aIndex) {
            let parentElt = this._getDOMNodeForPlacesNode(aParentPlacesNode);
            if (parentElt._built) {
                this._mayAddCommandsItems(parentElt);
                abHere2.moveOpTabsAndHomePageItems(parentElt);
            }
        });

        //*** fix display problem on Object.getPrototypeOf(PlacesPanelview).nodeRemoved()
        abHere2.hackFunc(Object.getPrototypeOf(PlacesPanelview), "nodeRemoved", null, function(arguments, aParentPlacesNode, aPlacesNode, aIndex) {
            let parentElt = this._getDOMNodeForPlacesNode(aParentPlacesNode);
            if (parentElt._built) {
                abHere2.moveOpTabsAndHomePageItems(parentElt);
            }
        });

        //*** move openintabs & openhomepage, add addbookmarkhere, control hidden/show of BookmarksMenu's menuitems
        abHere2.hackFunc(Object.getPrototypeOf(PlacesPanelview), "_onPopupShowing", null, function(arguments, aEvent) {
            let popup = aEvent.originalTarget;
            if (popup._placesNode && PlacesUIUtils.getViewForNode(popup) == this) {
                abHere2.onpopupBookmarksMenu(aEvent);
            }
        });

        //*** implement folder.middleClick feature
        abHere2.hackFunc(PlacesUIUtils, "openContainerNodeInTabs", function(arguments, aNode, aEvent, aView) {
            if (abHere2.handleMiddleClickFolder(aEvent)) { return true; }
        });

        //*** implement folderId.bookmark feature
        //decide folderId when user bookmark current page
        abHere2.hackFunc(PlacesCommandHook, "bookmarkCurrentPage", function(arguments, aShowEditUI, aParent) {
            arguments[1] = aShowEditUI ? abHere2.prefBookmarkFolderId : aParent;
        });

        //remember last selected folder when user press [ENTER] or click [DONE] to bookmark a page
        abHere2.hackFunc(StarUI, "handleEvent", function(arguments, aEvent) {
            if ((aEvent.type == "popuphidden") && (aEvent.originalTarget == this.panel)) {
                if ((this._actionOnHide != "cancel") && (this._actionOnHide != "remove")) {
                    abHere2.saveBookmarkFolderId(gEditItemOverlay._getFolderIdFromMenuList());
                }
            }
        });

        //*** implement folderId.unsorted feature
        //redirect the unsortedBookmarksFolder if user want to customize it
        abHere2.hackFunc(PlacesCreateBookmarkTransaction.prototype, "doTransaction", function(arguments) {
            this.item.parentId = (this.item.parentId == PlacesUtils.unfiledBookmarksFolderId) ? abHere2.unsortedBookmarksFolderId : this.item.parentId;
        });

        //*** customize editBookmarkPanel each row's hidden/show
        abHere2.hackFunc(gEditItemOverlay, "initPanel", function(arguments, aInfo) {
            aInfo.hiddenRows = abHere2.hiddenRows;
        });

        //*** customize editBookmarkPanel UI
        abHere2.hackFunc(StarUI.panel, "openPopup", function(arguments) {
            abHere2.createResizer("folderTree");
            abHere2.createResizer("tagsSelector");
            abHere2.createResizer("descriptionField");
            document.getElementById("editBookmarkPanel").removeAttribute("height");
            document.getElementById("editBookmarkPanelGrid").width = abHere2.panelWidth;
        });

        //*** expand the folderTree & tagsSelector if the bookmark has already existed
        abHere2.hackFunc(StarUI, "_doShowEditBookmarkPanel", function(arguments, aNode, aAnchorElement, aPosition) {
            StarUI.anchorIsPlacesNode = aAnchorElement && aAnchorElement._placesNode ? true : false;
        }, function(arguments, aNode, aAnchorElement, aPosition) {
            abHere2.expandRows();
            abHere2.correctRemoveButtonCount(makeURI(aNode.uri));
        });

        //*** make tagsSelector grouping the tags in inline
        abHere2.hackFunc(StarUI, "panelShown", function(arguments) {
            let tagsBox = document.getAnonymousNodes(document.getElementById("editBMPanel_tagsSelector"))[1].lastChild;
            tagsBox.style.display = (abHere2.isTagsInline ? "inline-block" : "");
        });

        //*** save tagsSelector expander's status
        abHere2.hackFunc(StarUI, "quitEditMode", function(arguments) {
            abHere2.isTagsRowExpand = !document.getElementById("editBMPanel_tagsSelectorRow").collapsed;
        });

        //*** prevent KeyEvent.DOM_VK_RETURN close editBookmarkPanel if the description field is focused
        //*** prevent KeyEvent.DOM_VK_RETURN close editBookmarkPanel if the tags field is autocompleted
        abHere2.hackFunc(StarUI, "handleEvent", function(arguments, aEvent) {
            if ((aEvent.type == "keypress") && (aEvent.keyCode == KeyEvent.DOM_VK_RETURN) && !aEvent.defaultPrevented) {
                if ((aEvent.target.id == "editBMPanel_descriptionField")) {
                    return true;
                }
                if ((aEvent.target.id == "editBMPanel_tagsField") && (aEvent.target.getAttribute("value") != aEvent.target.value)) {
                    aEvent.target.setAttribute("value", aEvent.target.value);
                    return true;
                }
            }
        });

        //*** make ensureRowIsVisible when user choose a folder from folderMenuList
        abHere2.hackFunc(gEditItemOverlay, "onFolderMenuListCommand", null, function(arguments) {
            this._folderTree.boxObject.ensureRowIsVisible(this._folderTree.view.selection.currentIndex);
        });

        //*** implement "allow to create duplicate bookmark" feature
        abHere2.hackFunc(PlacesUtils, "getMostRecentBookmarkForURI", function(arguments) {
            if (abHere2.isDupBmkAllowed) { return -1; }
        });

        //*** replace bookmarkLink UI with editBookmarkPanel
        abHere2.hackFunc(nsContextMenu.prototype, "bookmarkLink", function(arguments) {
            return abHere2.bookmarkLink.apply(this, arguments);
        });

        //*** implement force disable folderMenuList
        abHere2.hackFunc(gEditItemOverlay, "_initFolderMenuList", null, function(arguments) {
            this._folderMenuList.disabled = this.readOnly || abHere2.isFolderMenuListDisabled;
        });

        window.addEventListener("load", abHere2.onload, false);
    },

    onload: function() {
        //*** implement show bookmark's path on star
        let star = BookmarkingUI.star;
        if (star) {
            star.addEventListener("mouseenter", abHere2.onpopupStarButtonTooltips, false);
        }

        //*** add ToolbarContextMenu's popup event handler
        let tbc = document.getElementById("toolbar-context-menu");
        if (tbc) {
            tbc.addEventListener("popupshowing", abHere2.onpopupToolbarContextMenu, false);
        }

        //*** add BookmarksContextMenu's popup event handler
        let bmc = document.getElementById("placesContext");
        if (bmc) {
            bmc.addEventListener("popupshowing", abHere2.onpopupBookmarksContextMenu, false);
            bmc.addEventListener("popuphiding", abHere2.oncloseBookmarksContextMenu, false);
        }

        //*** move BMB_viewBookmarksToolbar to be together with BMB_viewBookmarksSidebar
        let vtb = document.getElementById("BMB_viewBookmarksToolbar");
        let vsb = document.getElementById("BMB_viewBookmarksSidebar");
        if (vsb && vtb) {
            vsb.parentNode.insertBefore(vtb.nextSibling, vsb.nextSibling);
            vsb.parentNode.insertBefore(vtb, vsb);
        }
    }
}
abHere2.init();
