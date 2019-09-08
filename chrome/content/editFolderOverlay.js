Components.utils.import("resource://gre/modules/Task.jsm");
var abHere2 = {
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

    getAnnoIsFolderSortByName: function(itemId) {
        return PlacesUtils.annotations.itemHasAnnotation(itemId, 'abhere2/sortByName')
            && PlacesUtils.annotations.getItemAnnotation(itemId, 'abhere2/sortByName');
    },
    setAnnoIsFolderSortByName: function(itemId, isSortByName) {
        let annoObj = { name: 'abhere2/sortByName', value: isSortByName, type: Ci.nsIAnnotationService.TYPE_INT32, flags: 0, expires: Ci.nsIAnnotationService.EXPIRE_NEVER };
        let txn = new PlacesSetItemAnnotationTransaction(itemId, annoObj);
        PlacesUtils.transactionManager.doTransaction(txn);
    },

    onSortByNameCheckboxCommand: function(checked) {
        abHere2.setAnnoIsFolderSortByName(gEditItemOverlay.itemId, checked);
    },

    init: function() {
        //===================================================
        //XXX: content/browser/places/editBookmarkOverlay.js
        //===================================================

        //*** decide "sortByName" checkbox hidden and checked status
        abHere2.hackFunc(gEditItemOverlay, "initPanel", null, function(arguments, aInfo) {
            let cbSortByName = document.getElementById("editBMPanel_sortByNameCheckbox");
            let isFolder = aInfo && aInfo.node && (aInfo.node.itemId !== -1) && (aInfo.node.type === Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER);
            let isReadOnly = aInfo && aInfo.node && PlacesUIUtils.isContentsReadOnly(aInfo.node.itemId);
            cbSortByName.collapsed = !isFolder || isReadOnly || (aInfo && aInfo.hiddenRows && (aInfo.hiddenRows.indexOf("sortByName") !== -1));
            cbSortByName.checked = aInfo && aInfo.node && abHere2.getAnnoIsFolderSortByName(aInfo.node.itemId);
        });
    }
}
abHere2.init();
