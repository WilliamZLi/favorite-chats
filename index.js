import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "favorite-chats";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    favorites: {},
    filterActive: false,
};

function getSettings() {
    return extension_settings[extensionName];
}

function isFavorite(fileName) {
    return !!getSettings().favorites[fileName];
}

function toggleFavorite(fileName) {
    const settings = getSettings();
    if (settings.favorites[fileName]) {
        delete settings.favorites[fileName];
    } else {
        settings.favorites[fileName] = true;
    }
    saveSettingsDebounced();
    updateFavCount();
    return !!settings.favorites[fileName];
}

function updateFavCount() {
    $('#fav_count').text(Object.keys(getSettings().favorites).length);
}

function applyFilter() {
    const filterActive = getSettings().filterActive;
    $('#select_chat_div .select_chat_block_wrapper').each(function () {
        const fileName = $(this).find('.select_chat_block').attr('file_name');
        $(this).toggle(!filterActive || isFavorite(fileName));
    });
}

function injectStarButtons() {
    $('#select_chat_div .select_chat_block_wrapper').each(function () {
        if ($(this).find('.fav_chat_btn').length) return;
        const block = $(this).find('.select_chat_block');
        const fileName = block.attr('file_name');
        if (!fileName) return;

        const btn = $('<div class="fav_chat_btn fa-star"></div>');
        btn.addClass(isFavorite(fileName) ? 'fa-solid' : 'fa-regular');
        btn.toggleClass('active', isFavorite(fileName));
        btn.on('click', function (e) {
            e.stopPropagation();
            const nowFav = toggleFavorite(fileName);
            $(this).toggleClass('active', nowFav)
                   .toggleClass('fa-solid', nowFav)
                   .toggleClass('fa-regular', !nowFav);
            if (getSettings().filterActive) applyFilter();
        });

        block.find('.PastChat_cross').before(btn);
    });
}

function injectFilterButton() {
    if ($('#fav_filter_btn').length) return;
    const btn = $('<div id="fav_filter_btn" class="menu_button menu_button_icon" title="Show favorites only"><i class="fa-solid fa-star"></i><span>Favorites</span></div>');
    btn.toggleClass('active', getSettings().filterActive);
    btn.on('click', function () {
        const settings = getSettings();
        settings.filterActive = !settings.filterActive;
        $(this).toggleClass('active', settings.filterActive);
        saveSettingsDebounced();
        applyFilter();
    });
    $('#select_chat_search').before(btn);
}

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    if (!extension_settings[extensionName].favorites) {
        extension_settings[extensionName].favorites = {};
    }
}

jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $('#extensions_settings2').append(settingsHtml);

    loadSettings();
    updateFavCount();

    // Watch for chat list population (covers popup open, search, delete refresh)
    const chatDiv = document.getElementById('select_chat_div');
    if (chatDiv) {
        new MutationObserver(() => {
            injectFilterButton();
            injectStarButtons();
            applyFilter();
        }).observe(chatDiv, { childList: true });
    }

    // Remove from favorites when a chat is deleted
    eventSource.on(event_types.CHAT_DELETED, (fileName) => {
        const settings = getSettings();
        if (settings.favorites[fileName]) {
            delete settings.favorites[fileName];
            saveSettingsDebounced();
            updateFavCount();
        }
    });

    $('#fav_clear_all').on('click', function () {
        if (!confirm('Clear all favorited chats?')) return;
        getSettings().favorites = {};
        saveSettingsDebounced();
        updateFavCount();
        // Refresh star button states
        $('#select_chat_div .fav_chat_btn').removeClass('active');
        if (getSettings().filterActive) applyFilter();
    });
});
