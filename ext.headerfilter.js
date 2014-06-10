// From https://github.com/danny-sg/slickgrid-spreadsheet-plugins
(function ($) {

    //TODO: Do something better than this? 
	//Need to allow searching the filters maybe like Excel?
    var MAX_FILTER_COUNT = 1000;
        
    $.extend(true, window, {
        "Ext": {
            "Plugins": {
                "HeaderFilter": HeaderFilter
            }
        }
    });

    function HeaderFilter(options) {
        var grid;
        var self = this;
        var handler = new Slick.EventHandler();
        var defaults = {
            filterClass: "ext-filtered",
            sortAscClass: "ext-sort-asc",
            sortDescClass: "ext-sort-desc"
        };
        var $menu;
        var baseFilter;

        function init(g) {
            options = $.extend(true, {}, defaults, options);
            grid = g;
            handler.subscribe(grid.onHeaderCellRendered, handleHeaderCellRendered)
                   .subscribe(grid.onBeforeHeaderCellDestroy, handleBeforeHeaderCellDestroy)
                   .subscribe(grid.onClick, handleBodyMouseDown)
                   .subscribe(grid.onColumnsResized, columnsResized);

            //JB: Not sure why this is needed???
            grid.setColumns(grid.getColumns());

            $(document.body).bind("mousedown", handleBodyMouseDown);
        }

        function destroy() {
            handler.unsubscribeAll();
            $(document.body).unbind("mousedown", handleBodyMouseDown);
        }

        function handleBodyMouseDown(e) {
            if ($menu && $menu[0] != e.target && !$.contains($menu[0], e.target)) {
                hideMenu();
            }
        }

        function hideMenu() {
            if ($menu) {
                $menu.remove();
                $menu = null;
            }
        }

        function handleHeaderCellRendered(e, args) {            
            var column = args.column;

            if (typeof (column.filterable) === 'undefined' || column.filterable) {
                var $el = $("<div></div>")
                    .addClass("slick-header-menubutton")
                    .data("column", column);

                setButtonImage($el, column.filterValues && column.filterValues.length);

                //if (options.buttonImage) {
                //    $el.css("background-image", "url(" + options.buttonImage + ")");
                //}

                $el.bind("click", showFilter).appendTo(args.node);
            }
        }

        function handleBeforeHeaderCellDestroy(e, args) {
            $(args.node)
                .find(".slick-header-menubutton")
                .remove();
        }

        function addMenuItem(menu, columnDef, title, command, className) {
            var $item = $("<div class='slick-header-menuitem'>")
                         .data("command", command)
                         .data("column", columnDef)
                         .bind("click", handleMenuItemClick)
                         .appendTo(menu);

            var $icon = $("<div class='slick-header-menuicon'>")
                         .appendTo($item);

            if (className) {
                $icon.addClass(className);
            }

            $("<span class='slick-header-menucontent'>")
             .text(title)
             .appendTo($item);
        }

        function formatValue(value, columnDef) {
            if (value == null)
                return '(Blank)';
            else if (columnDef.formatter) {
                return columnDef.formatter(null, null, value, columnDef, null);
            } else {
                return value;
            }
        }

        function showFilter(e) {
            var $menuButton = $(this);
            var columnDef = $menuButton.data("column");

            columnDef.filterValues = columnDef.filterValues || [];

            // WorkingFilters is a copy of the filters to enable apply/cancel behaviour
            var workingFilters = columnDef.filterValues.slice(0);
            var filterItems;

            filterItems = getAllFilterValues(grid.getData().getItems(), columnDef);
            
            if (!$menu) {
                $menu = $("<div class='slick-header-menu'>").appendTo(document.body);
            }

            $menu.empty();

            if (columnDef.sortable) {
                addMenuItem($menu, columnDef, 'Sort Ascending', 'sort-asc', options.sortAscClass);
                addMenuItem($menu, columnDef, 'Sort Descending', 'sort-desc', options.sortDescClass);
            }

            var filterOptions = '';

            if (filterItems === null) {
                if (workingFilters.length > 0) {
                    filterItems = workingFilters;
                } else {
                    filterItems = [];
                }
                filterOptions += "<span style='color: red'>There are too many options to show.</span>";
            }

            filterOptions += "<label><input type='checkbox' value='-1' />(Select All)</label>";

            for (var i = 0; i < filterItems.length; i++) {
                var filtered = _.contains(workingFilters, filterItems[i]);

                filterOptions += "<label><input type='checkbox' value='" + i + "'"
                                 + (filtered ? " checked='checked'" : "")
                                 + "/>" + formatValue(filterItems[i], columnDef) + "</label>";
            }

            var $filter = $("<div class='filter'>")
                           .append($(filterOptions))
                           .appendTo($menu);

            $('<button>OK</button>')
                .appendTo($menu)
                .bind('click', function (ev) {
                    columnDef.filterValues = workingFilters.splice(0);                    
                    setButtonImage($menuButton, columnDef.filterValues.length > 0);
                    handleApply(ev, columnDef);                   
                });

            $('<button>Clear</button>')
                .appendTo($menu)
                .bind('click', function (ev) {
                    columnDef.filterValues.length = 0;
                    setButtonImage($menuButton, false);
                    handleApply(ev, columnDef);
                });

            $('<button>Cancel</button>')
                .appendTo($menu)
                .bind('click', hideMenu);

            $(':checkbox', $filter).bind('click', function () {
                workingFilters = changeWorkingFilter(filterItems, workingFilters, $(this));
            });

            var offset = $(this).offset();
            var left = offset.left - $menu.width() + $(this).width() - 8;
            var top = offset.top + $(this).height();
            var bottom = offset.top + $(this).height() + $menu[0].offsetHeight;
            var windowHeight = $(window).height();

            if (bottom >= windowHeight) {
                $filter.css('height', $filter.height() - (bottom - windowHeight) - 1);
            }

            $menu.css("top", top)
                 .css("left", (left > 0 ? left : 0));

            e.preventDefault();
            e.stopPropagation();
        }

        function columnsResized() {
            hideMenu();
        }

        function changeWorkingFilter(filterItems, workingFilters, $checkbox) {
            var value = $checkbox.val();
            var $filter = $checkbox.parent().parent();

            if ($checkbox.val() < 0) {
                // Select All
                if ($checkbox.prop('checked')) {
                    $(':checkbox', $filter).prop('checked', true);
                    workingFilters = filterItems.slice(0);
                } else {
                    $(':checkbox', $filter).prop('checked', false);
                    workingFilters.length = 0;
                }
            } else {
                var index = _.indexOf(workingFilters, filterItems[value]);

                if ($checkbox.prop('checked') && index < 0) {
                    workingFilters.push(filterItems[value]);
                }
                else {
                    if (index > -1) {
                        workingFilters.splice(index, 1);
                    }
                }
            }

            return workingFilters;
        }

        function setButtonImage($el, filtered) {
            if (filtered) {
                $el.addClass(options.filterClass);
            } else {
                $el.removeClass(options.filterClass);
            }            
        }

        function handleApply(e, columnDef) {
            hideMenu();

            self.onFilterApplied.notify({ "grid": grid, "column": columnDef }, e, self);
            
            e.preventDefault();
            e.stopPropagation();
        }

        function getAllFilterValues(data, column) {                        
            var seen = [];
            var filter = composeCurrentFilter(baseFilter, column);

            for (var i = 0; i < data.length; i++) {
                if (!filter(data[i])) {
                    continue;
                }
                var value = data[i][column.field];
                if (!_.contains(seen, value)) {
                    seen.push(value);
                    if (seen.length >= MAX_FILTER_COUNT) {
                        return null;
                    }
                }
            }
                       
            return _.sortBy(seen, function (v) { return v || undefined; });
        }

        function handleMenuItemClick(e) {
            var command = $(this).data("command");
            var columnDef = $(this).data("column");

            hideMenu();

            self.onCommand.notify({
                "grid": grid,
                "column": columnDef,
                "command": command
            }, e, self);

            e.preventDefault();
            e.stopPropagation();
        }
        
        // expose a method that can be used to set a filter function that might be used by the dataView that is applied before header filters.        
        function setBaseFilter(filterFn){
            baseFilter = filterFn;
        }
                
        function composeCurrentFilter(baseFilterFn, excludeColumn){
            ///<summary>Creates a filter function that applies all column based filters to a row.</summary>
            var cols = grid.getColumns();
            var activeFilters = [];
            
            for (var i = 0; i < cols.length; i++) {
                if (cols[i] !== excludeColumn && cols[i].filterValues && cols[i].filterValues.length) {
                    activeFilters.push(cols[i]);
                }
            }

            return function (row) {
                if (typeof baseFilterFn === 'function') {
                    if (!baseFilterFn(row)) {
                        return false;
                    }
                }
                for (var i = 0; i < activeFilters.length; i++) {                    
                    // if filter values list does not cell value, return false to filter out row
                    var result = false;
                    for (var x = 0; x < activeFilters[i].filterValues.length; x++) {
                        if (row[activeFilters[i].field] === activeFilters[i].filterValues[x]) {
                            result = true;
                            break;
                        }
                    }
                    if (!result) {
                        return false;
                    }                  
                }
                return true;
            };
        }

        $.extend(this, {
            "init": init,
            "destroy": destroy,
            "onFilterApplied": new Slick.Event(),
            "onCommand": new Slick.Event(),
            "setBaseFilter": setBaseFilter,
//            "composeFilter": composeFilter
        });
    }
})(jQuery);