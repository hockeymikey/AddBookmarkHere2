Components.utils.import("resource://gre/modules/Preferences.jsm");

// convert value on sync to preference
function onsynctopreference(self) {
    let preference = document.getElementById(self.getAttribute("preference"));
    let value = preference.value;
    switch (self.tagName) {
        case "checkbox":
            value = (self.checked ? PlacesUtils.unfiledBookmarksFolderId : 0);
            break;
        case "tree":
            if (self.selectedNode) value = preference.value = PlacesUtils.getConcreteItemId(self.selectedNode);
            break;
    }
    return value;
}

// convert value on sync from preference
function onsyncfrompreference(self) {
    let preference = document.getElementById(self.getAttribute("preference"));
    let value = preference.value;
    switch (self.tagName) {
        case "checkbox":
            value = !!value;
            break;
        case "tree":
            if (!self.place) {
                self.place = "place:excludeItems=1&excludeQueries=1&excludeReadOnlyFolders=1&folder="+PlacesUIUtils.allBookmarksFolderId;
            }
            if (value == 0) {
                self.disabled = true;
                self.selectItems([]);
            } else {
                self.disabled = false;
                self.selectItems([value]);
                setTimeout(function(){ self.boxObject.ensureRowIsVisible(self.view.selection.currentIndex); }, 0);
            }
            break;
    }
    return value;
}

// decide viewpockt item display or not
function onshowviewpocket(self) {
    self.hidden = !Preferences.get("extensions.pocket.enabled", true);
    return onsyncfrompreference(self);
}
