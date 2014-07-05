define(function (require) {
    var $ = require('jquery');
    var d3 = require('d3');
    var d3_context = require('d3-context');

    var plugin_context = {
        extract_transform: function (transform_str) {
            var groups =
                /translate\((-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)\).*scale\((\d+(\.\d+)?)(,(\d+(\.\d+)?))?\)/
                .exec(transform_str);
            return {translate: [parseFloat(groups[1]), parseFloat(groups[3])],
                    scale: parseFloat(groups[5])};
        },
        DynamicSvg: function (container, svg_element, margin) {
            /* # `DynamicSvg` #
             *
             * This prototype creates an `<svg>` tag within
             * [`d3`][1]-compatible `container` appends the contents of the
             * provided `<svg ...>` tag object to the newly created `<svg ...>`
             * tag.  The contents of the SVG are automatically scaled to fit
             * within the `container`. */

            this.container = container;
            this.margin = (typeof(margin) == "undefined") ? 0 : margin;
            this.default_settings = {scale: 1., translate: [0, 0]};
            this._zoom_stack = [];
            this.context = new d3_context.D3Context();
            d3.selectAll(this.container).data([this]);
            this.zoom_settings = d3.behavior.zoom().scaleExtent([0.1, 8]);
            this.reset_zoom = $.proxy(function () {
                /* Reset zoom to according to the settings from the most
                 * recent call to `zoom_to_fit`. */
                this.zoom(this.default_settings.scale,
                          this.default_settings.translate);
            }, this);
            this.zoom = $.proxy(function (scale, translate) {
                /* Update zoom-settings accorinding to the specified `scale`
                 * and `translate` values, then apply the zoom to the SVG
                 * canvas. */
                this.zoom_settings.translate(translate);
                this.zoom_settings.scale(scale);
                this._zoom();
            }, this);
            this.push_zoom = $.proxy(function (transform, duration) {
                this._zoom_stack.push(this.transform());
                this.zoom_from_transform(transform, duration);
            }, this);
            this.pop_zoom = $.proxy(function (duration) {
                if (this._zoom_stack.length > 0) {
                    return this.zoom_from_transform(this._zoom_stack.pop(),
                                                    duration);
                } else {
                    return this.zoom_to_fit(duration);
                }
            }, this);
            this.zoom_from_transform = $.proxy(function (transform, duration) {
                return this.smooth_zoom(transform.scale, transform.translate,
                                        duration);
            }, this);
            this.smooth_zoom = $.proxy(function (scale, translate, duration) {
                /* Update zoom-settings accorinding to the specified `scale`
                 * and `translate` values, then apply the zoom to the SVG
                 * canvas. */
                duration = (typeof(duration) == "undefined") ? 750 : duration;
                this.zoom_settings.translate(translate);
                this.zoom_settings.scale(scale);
                return this.canvas.transition().duration(duration)
                           .attr("transform", "translate(" +
                                 this.zoom_settings.translate() + ")scale(" +
                                 this.zoom_settings.scale() + ")");
            }, this);
            this.transform = $.proxy(function () {
                /* Return the current zoom settings as object. */
                return extract_transform(d3.select(this.svg[0]).attr('transform'));
            }, this);
            this._zoom = $.proxy(function () {
                /* Apply the current zoom-settings to the SVG canvas. */
                d3.select(this.svg[0]).attr("transform", "translate(" +
                              this.zoom_settings.translate()
                              + ")scale(" + this.zoom_settings.scale()
                              + ")");
            }, this);
            this.resize = $.proxy(function (new_size, duration) {
                /* Resize SVG to specified width/height. */
                var duration = ((typeof duration == "undefined") ? 750
                                                                 : duration);
                var parent = d3.selectAll(this.container);
                var size = {width: parseInt(parent.style('width')),
                            height: parseInt(parent.style('height'))};
                if ('width' in new_size) {
                    var w = parseInt(new_size.width);
                    parent.style('width', w + "px");
                    parent.select('svg').attr('width', w);
                }
                if ('height' in new_size) {
                    var h = parseInt(new_size.height);
                    parent.style('height', h + "px");
                    parent.select('svg').attr('height', h);
                }
                return this.zoom_to_fit(duration);
            }, this);
            this.transform_from_contents = $.proxy(function (bbox) {
                /* Resize SVG image to fit within container. */
                if (typeof(bbox) == "undefined") {
                    bbox = this.bbox();
                }
                var img_size = {width: parseInt(d3.selectAll(this.container)
                                                .style('width')),
                                height: parseInt(d3.selectAll(this.container)
                                                 .style('height'))};
                var scales = {width: img_size.width / bbox.width,
                              height: img_size.height / bbox.height}
                var scale;
                if (scales.height < scales.width) {
                    scale = scales.height;
                } else {
                    scale = scales.width;
                }
                var translate = [-bbox.x * scale, -bbox.y * scale];
                translate[0] += 0.5 * (img_size.width - bbox.width * scale);
                translate[1] += 0.5 * (img_size.height - bbox.height * scale);
                return {scale: scale, translate: translate};
            }, this);
            this.zoom_to_fit = $.proxy(function (duration) {
                /* Resize SVG image to fit within container. */
                var transform_settings = this.transform_from_contents();
                this.default_settings.scale = transform_settings.scale;
                this.default_settings.translate = transform_settings.translate;
                if (typeof(duration) != "undefined") {
                    return this.smooth_zoom(this.default_settings.scale,
                                            this.default_settings.translate,
                                            duration);
                } else {
                    this.reset_zoom();
                }
            }, this);
            this.zoom_group = d3.selectAll(this.container).append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
              .append('g').attr('class', 'zoom');
            this.zoom_group.append('rect')
                .attr('class', 'img-background')
                .attr('width', '100%')
                .attr('height', '100%')
                .style('fill', 'white');
            this.canvas = this.zoom_group.append('g').attr('class', 'canvas')
                .attr('width', this.zoom_group.style('width'))
                .attr('height', this.zoom_group.style('width'));
            this.action_buttons = this.zoom_group.append('g')
                .attr('id', 'action_buttons')
                .style('opacity', 0.2);
            this.reset_button = this.action_buttons.append('g')
                .attr('id', 'reset')
            this.reset_button.append('rect')
                .attr('height', 20.6)
                .attr('width', 20)
                .attr('y', 0)
                .attr('x', 0)
                .attr('opacity', 0.1)
                .attr('fill', "#8c8c8c");
            this.save_canvas_button = this.action_buttons.append('rect')
                .attr('class', 'save')
                .attr('height', 20.6)
                .attr('width', 20)
                .attr('y', 0)
                .attr('x', 25)
                .attr('opacity', 0.2)
                .attr('fill', "#000000")
                .on('click', $.proxy(function () {
                    d3_context.save(d3.select(this.container[0])
                                    .select('svg'));
                }, this));
            this.save_frame_button = this.action_buttons.append('rect')
                .attr('class', 'save-frame')
                .attr('height', 18)
                .attr('width', 18)
                .attr('y', 2)
                .attr('x', 50)
                .attr('fill-opacity', 0.2)
                .attr('stroke', "#eeeeee")
                .attr('stroke-width', 4)
                .attr('fill', "#000000")
                .on('click', $.proxy(function () {
                    d3_context.save(this.canvas);
                }, this));
            var reset_arrow = this.reset_button
              .append('g').attr('transform', "translate(-251.59375,-292.3507)")
              .append('g').attr('transform',
                                "matrix(0.28260646,0,0,0.28260646,180.49173,224.4545)")
            reset_arrow.append('path')
                .attr('stroke', "#88bde6")
                .attr('stroke-miterlimit', "4")
                .attr('stroke-width', "10")
                .attr('fill', "none")
                .attr('d', "M315.77,290.87c-5.2,10.1-15.72,17.01-27.86,17.01-17.3,0-31.32-14.03-31.32-31.32s14.02-31.31,31.32-31.31c9.36,0,17.76,4.1,23.5,10.62");
            reset_arrow.append('path')
                .attr('fill', "#88bde6")
                .attr('d', "M322.36,240.59,322.36,266.82,296.13,266.82z");
            this.action_buttons.on('mouseover', function () { d3.select(this).style('opacity', 1.); });
            this.action_buttons.on('mouseout', function () { d3.select(this).style('opacity', 0.2); });
            this.reset_button.on('click',
                                 $.proxy(function () { this.zoom_to_fit(300); }, this));
            this.style = $.proxy(function (selectors, attr, value) {
                /* Apply the specified style attribute to the list of selectors
                 * relative to the SVG canvas. */
                for (var i = 0; i < selectors.length; i++) {
                    this.selectAll(selectors[i]).style(attr, value);
                }
            }, this.canvas);
            this._bbox = null;
            this.bbox = $.proxy(function (reset) {
                var bbox = this.svg[0].getBBox();
                bbox.x -= this.margin;
                bbox.y -= this.margin;
                bbox.width += 2 * this.margin;
                bbox.height += 2 * this.margin;
                var empty = (bbox.width == 0 || bbox.height == 0);
                if (empty) {
                    /* Bounding-box was reported to be empty.  Temporarily show hidden
                     * elements, and recompute bounding-box, just in case the SVG is
                     * not actually _empty_. */
                    var hidden = d3.select(this.svg[0])
                                   .selectAll('[style*="display: none;"]');
                    hidden.style('display', 'block');
                    bbox = this.svg[0].getBBox();
                    hidden.style('display', 'none');
                }
                if (this._bbox == null || (typeof(reset) != "undefined" &&
                                           reset)) {
                    this._bbox = bbox;
                } else {
                    this._bbox.width = Math.max(this._bbox.width, bbox.width);
                    this._bbox.height = Math.max(this._bbox.height, bbox.height);
                    this._bbox.x = Math.min(this._bbox.x, bbox.x);
                    this._bbox.y = Math.min(this._bbox.y, bbox.y);
                }
                return this._bbox;
            }, this);
            this.show = $.proxy(function (selectors) {
                /* Make the elements corresponding to the provided selectors
                 * visible. */
                this.style(selectors, 'display', 'block');
            }, this);
            this.hide = $.proxy(function (selectors) {
                /* Hide the elements corresponding to the provided selectors. */
                this.style(selectors, 'display', 'none');
            }, this);

            /* Initialize SVG from the provided `<svg>` tag element. */
            var element_count = svg_element.childElementCount;
            if (svg_element.childNodes.length == element_count) {
                for (var i = 0; i < element_count; i++) {
                    var child = svg_element.childNodes[0];
                    this.canvas[0][0].appendChild(child);
                }
            } else {
                for (var i = 0; i < element_count; i++) {
                    var child = svg_element.children[0];
                    this.canvas[0][0].appendChild(child);
                }
            }
            this.svg = this.canvas[0];
            this.zoom_settings.on("zoom", $.proxy(this._zoom, this));
            d3.selectAll(this.container).select('g.zoom').call(this.zoom_settings);
            return this.zoom_to_fit();
        }
    };

    plugin_context.svgs = [];
    plugin_context.svgs_by_id = {};

    plugin_context.from_svg_element = function (svg_element, margin) {
        var container = $(svg_element.parentNode);
        container[0].removeChild(svg_element);
        var svg = new plugin_context.DynamicSvg($(container), svg_element,
                                                margin);
        plugin_context.svgs.push(svg);
        plugin_context.svgs_by_id[container[0].id] = svg;
        return svg;
    };

    plugin_context.from_svg_obj = function (container, svg_obj, margin) {
        var svg = new plugin_context.DynamicSvg($(container), svg_obj, margin);
        plugin_context.svgs.push(svg);
        plugin_context.svgs_by_id[container[0].id] = svg;
        return svg;
    };

    plugin_context.auto_register = function() {
        d3.selectAll('div.dynamic-svg').each(function () {
            $(this).html('');
            var url = d3.select(this).attr('data-url');
            var to_hide = d3.select(this).attr('data-hide');
            var parent_end = url.lastIndexOf('/');
            var svg_name = url.substr(parent_end + 1);
            var svg_namebase = svg_name.substr(0, svg_name.lastIndexOf('.svg'))
            var that = this;
            d3.xml(url, "image/svg+xml", function(xml) {
                var element_count = xml.documentElement.childElementCount;
                var obj = window.document.createElement('svg');
                var children = [];
                for (var i = 0; i < element_count; i++) {
                    children.push(xml.documentElement.children[i]);
                }
                for (var i = 0; i < children.length; i++) {
                    obj.appendChild(children[i]);
                }
                return plugin_context.from_svg_obj($(that), obj);
            });
        });

        /* Replace SVG tags with the class `dynamic-svg` with a new `<svg>` tag
         * that is controlled by a `DynamicSvg` object.
         *
         * __NB__ The `DynamicSvg` object is registered in `svgs_by_id` using
         * the `id` of the parent element of the original `<svg>` tag. */
        d3.selectAll('svg.dynamic-svg').each(function () {
            return plugin_context.from_svg_element(this);
        });
        return plugin_context;
    }
    return plugin_context;
});
