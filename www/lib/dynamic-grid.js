define(function (require) {
    var $ = require('jquery');
    var d3 = require('d3');
    var dynamic_svg = require('dynamic-svg');
    var grid = require('grid');

    var plugin_context = {
        DynamicGrid: function(svg_element, nodes, margin) {
            this.$dsvg = dynamic_svg.from_svg_element(svg_element, margin);
            this.$grid = new grid.Grid(this.$dsvg.canvas.node());

            var self = this;

            self.zoom_to_selected = function(settings) {
              var selected = (self.$grid.$svg.selectAll('.selected').data()
                              .map(function (d) { return d.key; }));
              return self.zoom_to_nodes(selected, settings);
            }

            this.zoom_to_nodes = function(node_keys, settings) {
                var settings = (typeof settings == "undefined") ? {} : settings;
                var duration =  ('duration' in settings) ? settings['duration']
                                                         : 750;
                var margin =  ('margin' in settings) ? settings['margin'] : 2;
                var enlarge_only = (('enlarge_only' in settings)
                                    ? settings['enlarge_only'] : false);
                if (typeof node_keys == "undefined" || node_keys.length == 0) {
                    return self.$dsvg.zoom_to_fit(duration);
                }
                var bbox = self.$grid.nodes_bbox(node_keys, margin);
                var transform = self.$dsvg.transform_from_contents(bbox);
                if (!enlarge_only || (self.$dsvg.zoom_settings.scale() >=
                                      transform.scale)) {
                    return self.$dsvg.zoom_from_transform(transform, duration);
                } else {
                    return self.$dsvg.zoom_from_transform(self.$dsvg
                                                          .default_settings,
                                                          duration);
                }
            }

            this.zoom_to_moved = function(nodes, settings) {
                var moved_keys = (self.$grid.moved_nodes(nodes)
                                  .map(function (d) { return d.source.key; }));
                return self.zoom_to_nodes(moved_keys, settings);
            }

            this.update_nodes = function(nodes, settings) {
                var settings = (typeof settings == "undefined") ? {} : settings;
                var resize = ('resize' in settings) ? settings['resize']
                                                    : true;
                var duration = ('duration' in settings) ? settings.duration
                                                        : 500;
                var zoom_to_moved = (('zoom_to_moved' in settings) ?
                                     settings['zoom_to_moved'] : false);
                var enlarge_to_moved = (('enlarge_to_moved' in settings) ?
                                        settings['enlarge_to_moved'] : true);
                if (resize && zoom_to_moved) {
                    self.zoom_to_moved(nodes, {enlarge_only: false});
                } else if (resize && enlarge_to_moved) {
                    self.zoom_to_moved(nodes, {enlarge_only: true});
                }
                return self.$grid.update_nodes(
                  nodes, {duration: duration,
                          scale: ('scale' in settings) ? settings.scale : true,
                          remove_missing: (('remove_missing' in settings)
                                           ? settings.remove_missing : true),
                          on_end: function () {
                            if (resize && !zoom_to_moved
                                && !enlarge_to_moved) {
                              self.$dsvg.bbox(true);
                              self.$dsvg.zoom_to_fit(duration);
                            }
                          }});
            }

            this.resize = function(size) {
                self.$grid.resize(size);
                self.$dsvg.resize(size);
            }
        }
    };
    return plugin_context;
});
