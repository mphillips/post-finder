(function(window, $, undefined) {
	"use strict";

	var cache = {};

	$.postFinder = function(element, options) {
		var defaults, mainTemplate, itemTemplate, $li;

		if ( 'mainTemplate' in cache ) {
			mainTemplate = cache['mainTemplate'];
		} else {
			mainTemplate = cache['mainTemplate'] = $('#tmpl-post-finder-main').html();
		}

		if ( 'itemTemplate' in cache ) {
			itemTemplate = cache['itemTemplate'];
		} else {
			itemTemplate = cache['itemTemplate'] = $('#tmpl-post-finder-item').html();
		}

		defaults = {
			template:                mainTemplate,
			fieldSelector:           'input[type=hidden]',
			selectSelector:          'select',
			listSelector:            '.list',
			counterSelector:         '.counter',
			searchContainerSelector: '.search-container',
			searchSelector:          '.search',
			searchButtonSelector:    '.button',
			resetSelector:           '.reset',
			statusSelector:          '.status',
			cancelSelector:          '.cancel',
			statusLabelSelector:     '.status-label',
			spinnerSelector:         '.spinner',
			resultsSelector:         '.results',
			querySelector:           'input[type=text]',
			nonceSelector:           '#post_finder_nonce'
		};

		var plugin = this;

		plugin.settings = {}; //empty object to store extended settings

		var $element = $(element), //store jquery object of el
			element  = element; //store html el

		plugin.init = function() {

			// over write defaults with passed options
			plugin.settings = $.extend({}, defaults, options);

			// all jquery objects are fetched once and stored in the plugin object
			plugin.$field           = $element.find(plugin.settings.fieldSelector),
			plugin.$list            = $element.find(plugin.settings.listSelector),
			plugin.$counter         = $element.find(plugin.settings.counterSelector),
			plugin.$select          = $element.find(plugin.settings.selectSelector),
			plugin.$searchContainer = $element.find(plugin.settings.searchContainerSelector),
			plugin.$search          = $element.find(plugin.settings.searchSelector),
			plugin.$searchButton    = plugin.$search.find(plugin.settings.searchButtonSelector),
			plugin.$reset           = plugin.$search.find(plugin.settings.resetSelector),
			plugin.$status          = plugin.$search.find(plugin.settings.statusSelector),
			plugin.$statusLabel     = plugin.$search.find(plugin.settings.statusLabelSelector),
			plugin.$cancel          = plugin.$search.find(plugin.settings.cancelSelector),
			plugin.$spinner         = plugin.$search.find(plugin.settings.spinnerSelector),
			plugin.$results         = plugin.$search.find(plugin.settings.resultsSelector),
			plugin.$query           = plugin.$search.find(plugin.settings.querySelector),
			plugin.nonce            = $(plugin.settings.nonceSelector).val();

			// bind select
			plugin.$select.on('change', function(e){
				plugin.add_item( $(this).val(), $('option:selected', this).text(), $('option:selected', this).data('permalink') );
			});

			// bind search button
			plugin.$searchButton.click(function(e){
				e.preventDefault();
				plugin.search();
			});

			// search on enter key press
			plugin.$search.find('input[type="text"]').keypress(function(e){
				if (e.which == 13) {
					e.preventDefault();
					plugin.search();
				}
			});

			plugin.$reset.click(function(e){
				e.preventDefault();
				plugin.$search.find('input[type="text"]').val('');
				plugin.search();
			});

			// bind list
			plugin.$list.sortable({
				placeholder: 'placeholder',
				update: function(ui, e) {
					plugin.serialize();
				}
			});

			// remove button
			plugin.$list.on('click', '.icon-remove', function(e){
				e.preventDefault();
				plugin.remove_item( $(this).closest('li').data('id') );
			});

			// add button
			plugin.$results.on('click', '.add', function(e){
				e.preventDefault();
				$li = $(this).closest('li');
				plugin.add_item( $li.data('id'), $li.find('.title').text(), $li.data('permalink') );
			});

			// bind number inputs
			plugin.$list.on('keypress', 'li input', function(e) {
				if( e.which == 13 ) {
					e.preventDefault();
					//plugin.move_item( $(this).closest('li'), $(this).val() );
					$(this).trigger('blur');
				}
			});

			plugin.$list.on('blur', 'li input', function(e){
				plugin.move_item( $(this).closest('li'), $(this).val() );
			});

			plugin.check_limit();
		};

		// move an element to a specific position if possible
		plugin.move_item = function( $el, pos ) {

			var $li = plugin.$list.find('li'),
				len = $li.length,
				$clone;

			// has to be a position thats available
			if( pos > len || pos < 1 ) {
				alert( 'Please pick a position between 1 and ' + len );
				return false;
			}

			// dont move it if were already there
			if( ( pos - 1 ) == $el.index() ) {
				return false;
			}

			// clone the element
			$clone = $el.clone();

			// first position
			if( pos == 1 ) {

				plugin.$list.prepend( $clone );

			// middle positions
			} else if( pos > 1 && pos < len ) {

				plugin.$list.find('li').eq( pos - 1 ).before( $clone );

			// last position
			} else if( pos == len ) {

				plugin.$list.append( $clone );
			}

			// remove the original element
			$el.remove();

			plugin.serialize();

		};

		plugin.add_item = function( id, title, permalink ) {//private method

			// make sure we have an id
			if( id == 0 )
				return;

			if( plugin.limit_reached() ) {
				alert( POST_FINDER_CONFIG.max_number_allowed );
				return;
			}

			// see if item already exists
			if( plugin.$list.find('li[data-id="' + id + '"]').length ) {
				alert( POST_FINDER_CONFIG.already_added );
				return;
			}

			// add item
			plugin.$list.append(_.template(plugin.settings.template, {
				id:        id,
				title:     title,
				edit_url:  POST_FINDER_CONFIG.adminurl + 'post.php?post=' + id + '&action=edit',
				permalink: permalink,
				pos:       plugin.$list.length + 1
			}));

			plugin.update_counter();

			// hide notice
			plugin.$list.find('.notice').hide();

			// remove from the lists
			plugin.$select.find('option[value="' + id + '"]').remove();
			plugin.$search.find('li[data-id="' + id + '"]').addClass('added');

			plugin.check_limit();

			// update the input
			plugin.serialize();
		};

		//Prv method to remove an item
		plugin.remove_item = function( id ) {
			plugin.$list.find('li[data-id="' + id + '"]').remove();

			plugin.update_counter();

			plugin.serialize();

			// show notice if no posts
			if( plugin.$list.find('li').length == 0 ) {
				plugin.$list.find('.notice').show();
			}

			// add the item back to the search list
			plugin.$search.find('li[data-id="' + id + '"]').removeClass('added');

			plugin.check_limit();
		};

		plugin.search = function() {

			if( plugin.limit_reached() ) {
				alert( POST_FINDER_CONFIG.max_number_allowed );
				return;
			}

			var html = '',
				timeout = 500,
				displayTimeout,
				query = plugin.$query.val(),
				data = {
					action: 'pf_search_posts',
					s: query,
					_ajax_nonce: plugin.nonce
				};

			// merge the default args in
			data = $.extend(data, $element.data('args'));

			// display loading
			plugin.disable_search();

			if ('' !== query) {
				plugin.$reset.show();
			} else {
				plugin.$reset.hide();
			}

			var request = $.ajax(
				ajaxurl,
				{
					type: 'POST',
					data: data,
					success: function(response) {
						if( typeof response.posts != "undefined" ) {

							// Delay updating the post list to prevent the spinner from rapidly appearing and dissapearing when sear results are returned quickly.
							displayTimeout = setTimeout(function(){

								if ( response.posts.length > 0 ) {
									for( var i in response.posts ) {
										html += _.template(itemTemplate, response.posts[i]);
									}
								} else {
									html = '<li>' + POST_FINDER_CONFIG.nothing_found + '</li>';
								}

								plugin.$results.html(html);
								plugin.enable_search();

							}, timeout);
						}
					},
					dataType: 'json'
				}
			);

			// user cancels serch
			plugin.$cancel.click(function(e){
				e.preventDefault();
				clearTimeout(displayTimeout);

				plugin.enable_search();
			});
		};

		plugin.serialize = function() {

			var ids = [], i = 1;

			plugin.$list.find('li').each(function(){
				$(this).find('input').val(i);
				ids.push( $(this).data('id') );
				i++;
			});

			plugin.$field.val( ids.join(',') );
		}

		plugin.limit_reached = function() {
			var $count = plugin.$list.find('li').length;

			if( $count < $element.data('limit') ) {
				return false;
			}

			return true;
		};

		plugin.check_limit = function() {
			if( plugin.limit_reached() ) {
				plugin.lock();
			} else {
				plugin.unlock();
			}
		};

		plugin.lock = function() {
			plugin.$searchButton.prop('disabled', true);
			plugin.$counter.find('.message').addClass('visible');
			plugin.$searchContainer.hide();
		}

		plugin.unlock = function() {
			plugin.$searchButton.prop('disabled', false);
			plugin.$counter.find('.message').removeClass('visible');
			plugin.$searchContainer.show();
		}

		plugin.update_counter = function() {
			var $count = plugin.$list.find('li').length;

			plugin.$counter.find('.current-count').html($count);
		}

		plugin.disable_search = function() {
			plugin.$searchButton.prop('disabled', true);
			plugin.$search.addClass('loading');
			plugin.$spinner.addClass('is-active');
			plugin.$cancel.show();
			plugin.$statusLabel.hide();
		}

		plugin.enable_search = function() {
			plugin.$results.addClass('full');
			plugin.$spinner.removeClass('is-active');
			plugin.$cancel.hide();
			plugin.$searchButton.prop('disabled', false);
		}

		plugin.init();

	};

	$.fn.postFinder = function(options) {

		return this.each(function() {
			if (undefined == $(this).data('postFinder')) {
				var plugin = new $.postFinder(this, options);
				$(this).data('postFinder', plugin);
			}
		});

	};

})(window, jQuery);
