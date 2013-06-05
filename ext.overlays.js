(function ($) {
    $.extend(true, window, {
        "Ext": {
            "Plugins": {
                "Overlays": Overlays
            }
        }
    });

    function Overlays(options) {
        var $headerOverlay;
        var $rowOverlay;
        var selectionOverlay;

        var currentColumn;
        var handleDragging;
        var grid;
        var self = this;
        var handler = new Slick.EventHandler();
        var dragDecorator;

        var defaults = {
            buttonCssClass: null,
            buttonImage: "../images/down.gif"
        };

        function init(g) {
            options = $.extend(true, {}, defaults, options);
            grid = g;

            dragDecorator = new overlayRangeDecorator(grid);

            $headerOverlay = createRowHeaderOverlay(1200);
            $rowOverlay = createRowHeaderOverlay(500);
            selectionOverlay = createSelectionOverlay();

            handler.subscribe(grid.onActiveCellChanged, activeCellChanged)
                   .subscribe(grid.onColumnsResized, columnResized)
                   .subscribe(grid.onScroll, gridScrolled);
        }

        function destroy() {
            handler.unsubscribeAll();
            selectionOverlay.$handle.unbind("dragstart", handleOverlayDragStart)
                                    .unbind('drag', handleOverlayDrag)
                                    .unbind('dragend', handleOverlayDragEnd);
        }

        function createRowHeaderOverlay(zIndex) {
            return $('<div>')
                    .addClass("header-overlay")
                    .css("position", "absolute")
                    .css("z-index", zIndex)
                    .appendTo('body');
        }

        function createSelectionOverlay() {
            var canvas = grid.getCanvasNode();
            var overlay = new Overlay(canvas);

            overlay.$handle
              .bind('dragstart', handleOverlayDragStart)
              .bind('drag', handleOverlayDrag)
              .bind('dragend', handleOverlayDragEnd);

            return overlay;
        }

        function activeCellChanged(e, args) {
            dragDecorator.hide();

            moveSelectionOverlay(e, args);
            moveHeaderRowOverlays(e, args);
        }

        function columnResized(e, args) {
            moveHeaderRowOverlays(e, args);
            moveSelectionOverlay(e, args);
        }

        function gridScrolled(e, args) {
            moveHeaderRowOverlays(e, args);
            moveSelectionOverlay(e, args);
        }

        function moveHeaderRowOverlays(e, args) {
            if (typeof args.cell != 'undefined') {
                currentColumn = args.cell;
            } else {
                if (!currentColumn) {
                    return;
                }
            }

            if (!grid.getActiveCell()) {
                $rowOverlay.hide();
                return;
            }

            $rowOverlay.show();

            var column = grid.getColumns()[currentColumn];

            $(".slick-header > div > div")
                .removeClass("selected-header");

            $('[id$=' + column.id + ']', '.slick-header')
                .addClass('selected-header');

            var headerHeight = $('.slick-header').height();
            var cellPosition = grid.getActiveCellPosition();
            var gridPosition = grid.getGridPosition();

            $rowOverlay.toggle(cellPosition.visible);
            $headerOverlay.toggle(cellPosition.visible);

            var headerWidth = Math.min(cellPosition.width,
                                       gridPosition.width - cellPosition.left + 4);

            $headerOverlay.css({
                left: cellPosition.left - 2,
                top: gridPosition.top + headerHeight - 2,
                width: headerWidth + 2,
                height: 2
            });

            $rowOverlay.css({
                left: gridPosition.left,
                top: cellPosition.top,
                width: 2,
                height: cellPosition.height
            });
        }

        function moveSelectionOverlay(e, args) {
            var activeCell = grid.getActiveCell();

            if (!activeCell) {
                selectionOverlay.toggle(false);
                return;
            }

            var column = grid.getColumns()[activeCell.cell];
            selectionOverlay.toggle(true);

            var position = grid.getCellNodeBox(activeCell.row, activeCell.cell);

            // Not coming through on the property so re-calculated
            position.height = position.bottom - position.top;
            position.width = position.right - position.left;

            selectionOverlay.$left.css({
                left: position.left - 2,
                top: position.top,
                width: 2,
                height: position.height
            });

            selectionOverlay.$right.css({
                left: position.left + position.width - 1,
                top: position.top,
                width: 2,
                height: position.height
            });

            selectionOverlay.$top.css({
                left: position.left - 2,
                top: position.top - 2,
                width: position.width + 3,
                height: 2
            });

            selectionOverlay.$bottom.css({
                left: position.left - 2,
                top: position.top + position.height - 1,
                width: position.width + 3,
                height: 2
            });

            selectionOverlay.$handle.css({
                left: position.left + position.width - 4,
                top: position.top + position.height - 4,
                width: 1,
                height: 1
            });
        }

        function handleOverlayDragStart(e, dd) {
            var canvas = grid.getCanvasNode();

            var cell = grid.getActiveCell();

            if (grid.canCellBeSelected(cell.row, cell.cell)) {
                handleDragging = true;
                e.stopImmediatePropagation();
            }

            if (!handleDragging) {
                return;
            }

            grid.focus();

            dd.range = { start: cell, end: {} };

            $(this).css({
                "background-color": "transparent",
                "border-color": "transparent"
            });

            return dragDecorator.show(new Slick.Range(cell.row, cell.cell));
        }

        function handleOverlayDrag(e, dd) {
            if (!handleDragging) {
                return;
            }

            var canvas = grid.getCanvasNode();

            e.stopImmediatePropagation();

            var end = grid.getCellFromPoint(
                e.pageX - $(canvas).offset().left,
                e.pageY - $(canvas).offset().top);

            if (!grid.canCellBeSelected(end.row, end.cell)) {
                return;
            }

            dd.range.end = end;

            dragDecorator.show(new Slick.Range(dd.range.start.row,
                                               dd.range.start.cell,
                                               end.row,
                                               dd.range.start.cell));
        }

        function handleOverlayDragEnd(e, dd) {
            if (!handleDragging) {
                return;
            }

            handleDragging = false;

            $(this).css({
                "background-color": "",
                "border-color": ""
            });

            dragDecorator.hideHandle();

            self.onFillUpDown.notify({ "grid": grid, "range": dragDecorator.getSelectedRange() }, e, self);

            e.preventDefault();
            e.stopPropagation();
        }

        function Overlay(target) {
            this.$left = $('<div>').addClass('header-overlay').appendTo(target);
            this.$right = $('<div>').addClass('header-overlay').appendTo(target);
            this.$top = $('<div>').addClass('header-overlay').appendTo(target);
            this.$bottom = $('<div>').addClass('header-overlay').appendTo(target);
            this.$handle = $('<div>').addClass("handle-overlay").appendTo(target);

            this.toggle = function(showOrHide) {
                this.$left.toggle(showOrHide);
                this.$right.toggle(showOrHide);
                this.$top.toggle(showOrHide);
                this.$bottom.toggle(showOrHide);
                this.$handle.toggle(showOrHide);
            };
        }

        function overlayRangeDecorator(targetGrid) {
            var decorator;
            var r;

            function show(range) {
                r = range;
                if (!decorator) {
                    decorator = new Overlay(grid.getCanvasNode());
                }

                var from = targetGrid.getCellNodeBox(range.fromRow, range.fromCell);
                var to = targetGrid.getCellNodeBox(range.toRow, range.toCell);

                decorator.$left.css({
                    top: from.top - 2,
                    left: from.left - 2,
                    height: to.bottom - from.top + 2,
                    width: 2
                });

                decorator.$right.css({
                    top: from.top - 2,
                    left: to.right - 1,
                    height: to.bottom - from.top + 2,
                    width: 2
                });

                decorator.$top.css({
                    top: from.top - 2,
                    left: to.left - 1,
                    height: 2,
                    width: to.right - from.left + 2
                });

                decorator.$bottom.css({
                    top: to.bottom - 1,
                    left: from.left - 2,
                    height: 2,
                    width: to.right - from.left + 3
                });

                decorator.$handle.css({
                    top: to.bottom - 3,
                    left: from.right - 4,
                    height: 1,
                    width: 1
                });

                return decorator;
            }

            function getSelectedRange() {
                return r;
            }

            function hide() {
                if (decorator) {
                    decorator.toggle(false);
                    decorator = null;
                }
            }

            function hideHandle() {
                decorator.$handle.hide();
            }

            return {
                hide: hide,
                hideHandle: hideHandle,
                show: show,
                getSelectedRange: getSelectedRange
            };
        }

        $.extend(this, {
            "init": init,
            "destroy": destroy,
            "onFillUpDown": new Slick.Event()
        });
    }
})(jQuery);