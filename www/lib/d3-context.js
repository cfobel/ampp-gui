define(function (require) {
    var $ = require('jquery');
    var d3 = require('d3');

    var plugin_context = {
        transform_string: function (transform_obj) {
            return ("translate(" + transform_obj.translate[0] + "," +
                    transform_obj.translate[1] + ")scale(" + transform_obj.scale +
                    ")");
        },

        extract_property_attrs: function (selector, property_attrs) {
            /* Extract the state one or more properties from each object
             * referenced by a `d3` selector.  Only the subset of attributes
             * corresponding to each respective property are extracted.
             *
             * # Arguments #
             *
             *  - `selector`: A `d3` selector.
             *  - `property_attrs`: An object of the form:
             *
             *      {<property 1>: [<attr1>, <attr2>, <attr3>, ...],
             *       <property 2>: [<attr1>, <attr2>, <attr3>, ...]}
             *
             * # Result #
             *
            /* The state of the requested property attributes for the objects
             * matching the provided `d3` selector.  The state is a Javascript
             * object of the form:
             *
             *     {<property 1>: [<d3 object 1>, {<attr1>: <value>,
             *                                     <attr2>: <value>,
             *                                     <attr3>: <value>, ...},
             *                     <d3 object 2>, {<attr1>: <value>,
             *                                     <attr2>: <value>,
             *                                     <attr3>: <value>, ...},
             *                     ... ],
             *      <property 2>: [<d3 object 1>, {<attr1>: <value>,
             *                                     <attr2>: <value>,
             *                                     <attr3>: <value>, ...},
             *                     <d3 object 2>, {<attr1>: <value>,
             *                                     <attr2>: <value>,
             *                                     <attr3>: <value>, ...},
             *                     ... ]}
             */
            var _property_attrs = {};
            for (var property in property_attrs) {
                var attrs = property_attrs[property];
                _property_attrs[property] = [];
                selector.each(function() {
                    var d3_element = d3.select(this);
                    /* Save the state of each style attribute in `style_attrs` list for the
                     * current element. */
                    var element_attrs = {};
                    for (var i = 0; i < attrs.length; i++) {
                        element_attrs[attrs[i]] = d3_element[property](attrs[i]);
                    }
                    _property_attrs[property].push([d3_element, element_attrs]);
                });
            }
            return _property_attrs;
        },

        merge_property_states: function (states) {
            /* Merge an array of several states, where each state is of the
             * form:
             *
             *     {<property 1>: [<d3 selector 1>, {<attr1>: <value>,
             *                                       <attr2>: <value>, ...},
             *                     <d3 selector 2>, {<attr1>: <value>,
             *                                       <attr2>: <value>, ...},
             *                     ... ],
             *      <property 2>: [<d3 selector 1>, {<attr1>: <value>,
             *                                       <attr2>: <value>, ...},
             *                     <d3 selector 2>, {<attr1>: <value>,
             *                                       <attr2>: <value>, ...},
             *                     ... ]}
             *
             * where:
             *
             *  - `<property *>` corresponds to either `attr` or `style`.
             *  - Each `<d3 selector *>` corresponds to a `d3` selector result.
             *  - Each `<attr*>` corresponds to a `attr` or `style` attribute,
             *    such as `transform`, `fill`, `stroke`, `stroke-width`, etc.
             *   - Each `<value>` specifies a value for the respective
             *     `<attr*>`.
             */
            var combined = {};
            for (var i = 0; i < states.length; i++) {
                var state = states[i];
                for (var property in state) {
                    if (property in combined) {
                        combined[property] = combined[property].concat(state
                                                                       [property]);
                    } else {
                        combined[property] = [].concat(state[property]);
                    }
                }
            }
            return combined;
        }
    };

    plugin_context.undo_state = function (selector, property_attr_values) {
        /* Save state of any property that would be modified by setting
         * `property_attr_values`.  This allows, e.g., to undo the changes due
         * in `property_attr_values`. */
        var property_attrs = {};
        for (var property in property_attr_values) {
            property_attrs[property] = Object.keys(property_attr_values
                                                   [property]);
        }
        return plugin_context.extract_property_attrs(selector, property_attrs);
    }

    plugin_context.extract_styles = function (selector, style_attrs) {
        return plugin_context.extract_property_attrs(selector, 'style',
                                                     style_attrs);
    }

    plugin_context.apply_state = function (state, duration) {
        /* Apply the state of attributes of one or more properties of
         * objects, according to the values in a state in the form returned
         * by `extract_property_attrs`. */

        if (typeof(duration) == "undefined") { duration = 500; }
        /* Restore saved state of property attributes for each element. */
        for (var property in state) {
            var property_state = state[property];
            for (var i = 0; i < property_state.length; i++) {
                var d3_element = property_state[i][0];
                var attrs = property_state[i][1];
                var transition;
                if (duration == 0) {
                    /* If duration is set to 0, do not apply d3 transition. */
                    transition = d3_element;
                } else {
                    transition = d3_element.transition().duration(duration);
                }
                for (var attr in attrs) {
                   transition = transition[property](attr, attrs[attr]);
                }
            }
        }
    }

    plugin_context.save = function (svg_selector) {
        /* Clone the SVG node since we will be applying styles to each element.
         * This is necessary to save styles that are set by CSS rules. */
        var container = svg_selector.node();

        var svg_width = '';
        var svg_height = '';
        while (svg_width == '') {
            var width = parseInt(d3.select(container).style("width"));
            var height = parseInt(d3.select(container).style("height"));
            if (width == width) {
                svg_width = ' width="' + width + 'px"';
                svg_height = ' height="' + height + 'px"';
                break;
            }
            container = container.parentNode;
            if (container == null) { break; }
        }
        console.log(["svg size: ", svg_width, svg_height]);

        var cloned_svg = svg_selector.node().cloneNode(true);

        /*  - Temporarily append cloned SVG so CSS styles will be applied. */
        window.document.body.appendChild(cloned_svg);

        /*  - Extract style attributes from each element in the SVG. */
        var element_states = (d3_context
                              .extract_property_attrs(d3.select(cloned_svg)
                                                      .selectAll('*'),
                                                      {style: ['font-size',
                                                               'fill',
                                                               'opacity',
                                                               'stroke',
                                                               'stroke-width',
                                                               'display']}));
        /*  - Apply styles so CSS rules will be reflected in the output. */
        plugin_context.apply_state(element_states, 0);

        open("data:image/svg+xml," +
             encodeURIComponent('<svg version="1.1"' + svg_width + svg_height
                                + ' xmlns="http://www.w3.org/2000/svg">' +
                                $(cloned_svg).html() + '</svg>'));
        window.document.body.removeChild(cloned_svg);
    }

    plugin_context.D3Context = function() {
        this.state_stack = [];
        this.extend = $.proxy(function (selector_property_attr_values, duration) {
            /* For each provided `d3` selector, apply the state of attributes
             * of one or more properties to the respective objects.
             *
             * # Arguments #
             *
             *  - `selector_property_attr_values`: An array of the form below.
             *
             *      [{'selector': <d3 selector 1>,
             *        'property_attr_values': <property_attr_values 1>},
             *       {'selector': <d3 selector 2>,
             *        'property_attr_values': <property_attr_values 2>},
             *       ...]
             *  - `duration`: The length of the animated transition
             *    _(optional)_.  A `duration` value of zero disables the
             *    transition animation.
             *
             * where `<property_attr_values *>` is a Javascript object of the
             * form accepted by the `push` method. */

            /* Save current state of property before modifying it. */
            var current_states = [];
            for (var i = 0; i < selector_property_attr_values.length; i++) {
                var selector = selector_property_attr_values[i].selector;
                var property_attr_values = (selector_property_attr_values[i]
                                            .property_attr_values);
                console.log([selector, property_attr_values]);
                current_states.push(plugin_context.undo_state(selector, property_attr_values));
            }
            this.state_stack.push(plugin_context.merge_property_states(current_states));

            if (typeof(duration) == "undefined") { duration = 500; }

            var transition;
            for (var i = 0; i < selector_property_attr_values.length; i++) {
                var selector = selector_property_attr_values[i].selector;
                var property_attr_values = (selector_property_attr_values[i]
                                            .property_attr_values);
                if (duration == 0) {
                    /* If duration is set to 0, do not apply d3 transition. */
                    transition = selector;
                } else {
                    transition = selector.transition().duration(duration);
                }
                for (var property in property_attr_values) {
                    var attrs = property_attr_values[property];
                    for (var attr in attrs) {
                       transition = transition[property](attr, attrs[attr]);
                    }
                }
            }
        }, this);
        this.push = $.proxy(function (selector, property_attr_values, duration) {
            /* Apply the state of attributes of one or more properties to the
             * objects referenced by the provided `d3` selector.
             *
             * # Arguments #
             *
             *  - `selector`: A `d3` selector referring to one or more objects.
             *  - `property_attr_values`: An object of the form below.
             *
             *      {<property 1>: {<attr1>: <value>, <attr2>: <value>, ...},
             *       <property 2>: {<attr1>: <value>, <attr2>: <value>, ...}}
             *  - `duration`: The length of the animated transition
             *    _(optional)_.  A `duration` value of zero disables the
             *    transition animation.
             * */

            this.extend([{'selector': selector,
                          'property_attr_values': property_attr_values}], duration);
        }, this);
        this.pop = $.proxy(function (duration) {
            /* "Undo" the most recently pushed property attributes state. */

            if (this.state_stack.length < 1) {
                /* Nothing to do. */
                return;
            }
            /* Apply the most recently saved state. */
            plugin_context.apply_state(this.state_stack.pop());
        }, this);
    }
    return plugin_context;
});
