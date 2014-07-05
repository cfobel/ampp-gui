define(function (require) {
    var $ = require('jquery');
    var d3 = require('d3');
    var _numeric = require('numeric');

    var plugin_context = {};

    plugin_context.transpose = function (arrays) {
      var m = arrays.length;
      var n = arrays[0].length;
      return d3.range(n).map(function (i) {
        return arrays.map(function (d) { return d[i]; }) });
    }

    plugin_context.bbox = function (positions, margin) {
        /* Return the bounding-box containing the specified nodes. */
        var INF = 1000000;
        margin = (typeof(margin) == "undefined") ? 0 : margin;
        var bbox = {min: {x: INF, y: INF},
                    max: {x: 0, y: 0}};
        var that = this;
        positions.map(function(d) {
          bbox.min.x = Math.min(bbox.min.x, d.x);
          bbox.min.y = Math.min(bbox.min.y, d.y);
          bbox.max.x = Math.max(bbox.max.x, d.x);
          bbox.max.y = Math.max(bbox.max.y, d.y);
        });

        return {x: (bbox.min.x < INF) ? bbox.min.x - margin : 0,
                y: (bbox.min.y < INF) ? bbox.min.y - margin : 0,
                width: Math.max(0, bbox.max.x - bbox.min.x + 2 *
                                margin),
                height: Math.max(0, bbox.max.y - bbox.min.y + 2 *
                                 margin)};
    }

    $(function () {
      plugin_context.SparseMatrix = function (dynamic_grid, coo_elements,
                                              row_class, column_class) {
          var self = this;

          self.$x_axis_type = 'columns';
          self.$grid = dynamic_grid;
          self.$ccsC = numeric.ccsScatter(coo_elements);
          self.$cooC = numeric.ccsGather(self.$ccsC);
          self.$row_class = ((typeof row_class == "undefined") ? 'sparse-row'
                             : row_class);
          self.$column_class = ((typeof column_class == "undefined")
                                ? 'sparse-column' : column_class);
          self.most_recent_view = null;

          self.base_row_labels = function () {
            return d3.zip(self.$cooC[0], self.$cooC[1], self.$cooC[2]).map(
              function (d) {
                var element = {label: d[0], key: 'r' + d[0] + '-' + d[1],
                               value: self.$cooC[2],
                               type: '.' + self.$row_class};
                element[self.$row_class] = d[0];
                element[self.$column_class] = d[1];
                return element;
            });
          }

          self.base_column_labels = function () {
            return d3.zip(self.$cooC[0], self.$cooC[1], self.$cooC[2]).map(
              function (d) {
                var element = {label: d[1], key: 'c' + d[0] + '-' + d[1],
                               value: self.$cooC[2],
                               type: '.' + self.$column_class};
                element[self.$row_class] = d[0];
                element[self.$column_class] = d[1];
                return element;
            });
          }

          self.base_elements = function () {
            return d3.zip(self.$cooC[0], self.$cooC[1], self.$cooC[2]).map(
              function (d) {
                var element = {label: d[2], key: [d[0], d[1]], value: d[2],
                               type: '.element'};
                /* If the value of the element is a number, set the label to
                * the value rounded to one decimal place for pretty displaying.
                * */
                if (typeof d[2] == 'number') {
                  element.label = +d[2].toFixed(1);
                }
                element[self.$row_class] = d[0];
                element[self.$column_class] = d[1];
                return element; });
          }

          self.column_dim = function () {
            return (self.$x_axis_type == 'columns') ? 'y' : 'x';
          }

          self.row_dim = function () {
            return (self.$x_axis_type == 'columns') ? 'x' : 'y';
          }

          self.column_axis_extent = function () {
            var dim = self.row_dim();
            var extent = d3.extent(self.$grid.$grid.$svg
                                   .selectAll('.node_group.' +
                                              self.$column_class).data().map(
                                     function (d) {
                                       return d.position[dim]; }));
            var result = {dim: dim, extent: extent};
            if (extent[0] != extent[1]) {
              result.dim = null;
            }
            return result;
          }

          self.row_axis_extent = function () {
            var flat_dim = self.row_dim();
            var extent = d3.extent(self.$grid.$grid.$svg
                                   .selectAll('.node_group.' + self.$row_class)
                                   .data().map(
                                     function (d) {
                                       return d.position[flat_dim]; }));
            var result = {dim: flat_dim, extent: extent};
            if (extent[0] != extent[1]) {
              result.dim = null;
            }
            return result;
          }

          self.axis_mapped_nodes = function (nodes) {
            if (self.$x_axis_type == 'rows') {
              return nodes.map(
                function (d) {
                  var t = {};
                  $.extend(t, d);
                  var x = t.position.x;
                  t.position.x = t.position.y;
                  t.position.y = x;
                  return t; });
            } else {
              return nodes;
            }
          }

          // Display netlist element adjacency matrix, $C$.
          self.display_axis = function (duration) {
            self.most_recent_view = [self.display_axis, duration];
            self.$C_row_labels = self.base_row_labels().map(
              function (d) { d.position = {x: d[self.$row_class] + 1, y: 0}; return d; });
            self.$C_column_labels = self.base_column_labels().map(
              function (d) { d.position = {x: 0, y: d[self.$column_class] + 1}; return d; });
            var nodes = self.axis_mapped_nodes(self.$C_row_labels
                                               .concat(self.$C_column_labels));
            self.$grid.update_nodes(nodes, {duration: duration})
                      .each('end',
                            function (d, i) {
                              if (i == 0) { self.$grid.$dsvg.zoom_to_fit(); }});
          }
          self.display_elements = function (duration) {
            self.most_recent_view = [self.display_elements, duration];
            self.$C_row_labels = self.base_row_labels().map(
              function (d) {
                d.position = {x: d[self.$row_class] + 1, y: 0}; return d; });
            self.$C_column_labels = self.base_column_labels().map(
              function (d) {
                d.position = {x: 0, y: d[self.$column_class] + 1};
                return d; });
            self.$C_elements = self.base_elements().map(
              function (d) {
                d.position = {x: d[self.$row_class] + 1,
                              y: d[self.$column_class] + 1};
                return d; });
            var nodes = self.axis_mapped_nodes(self.$C_elements
                                               .concat(self.$C_row_labels,
                                                       self.$C_column_labels));
            self.$grid.update_nodes(nodes, {resize: true, scale: true,
                                    duration: duration}).each(
              'end', function (d, i) {
                if (i == 0) {
                  self.$grid.$dsvg.zoom_to_fit();
                }
            });
          }
          self.display_axis(500);
          self.label_elements = function (duration) {
            self.most_recent_view = [self.label_elements, duration];
            self.$C_row_labels = self.base_row_labels().map(
              function (d) { d.position = {x: d[self.$row_class] + 1, y: 2 * d[self.$column_class]}; return d; });
            self.$C_column_labels = self.base_column_labels().map(
              function (d) { d.position = {x: 0, y: 2 * d[self.$column_class] + 1}; return d; });
            self.$C_elements = self.base_elements().map(
              function (d) {
                d.position = {x: d[self.$row_class] + 1, y: 2 * d[self.$column_class] + 1};
                return d; });

            var nodes = self.axis_mapped_nodes(self.$C_elements
                                               .concat(self.$C_row_labels,
                                                       self.$C_column_labels));
            self.$grid.update_nodes(nodes, {resize: false,
                                            duration: duration});
          }
          self.spread_elements = function (duration) {
            self.most_recent_view = [self.spread_elements, duration];
            self.$C_row_labels = self.base_row_labels().map(
              function (d, i) { d.position = {x: 2 * d[self.$row_class] + 2, y: i + 1}; return d; });
            self.$C_column_labels = self.base_column_labels().map(
              function (d, i) { d.position = {x: 0, y: i + 1}; return d; });
            self.$C_elements = self.base_elements().map(
              function (d, i) {
                d.position = {x: 2 * d[self.$row_class] + 1, y: i + 1};
                return d; });
            var nodes = self.axis_mapped_nodes(self.$C_elements
                                               .concat(self.$C_row_labels,
                                                       self.$C_column_labels));
            self.$grid.update_nodes(nodes, {resize: false,
                                            duration: duration});
          }
          self.flatten_elements = function (duration) {
            self.most_recent_view = [self.flatten_elements, duration];
            self.$C_row_labels = self.base_row_labels().map(
              function (d, i) { d.position = {x: 1, y: i + 1}; return d; });
            self.$C_column_labels = self.base_column_labels().map(
              function (d, i) { d.position = {x: 2, y: i + 1}; return d; });
            self.$C_elements = self.base_elements().map(
              function (d, i) {
                d.position = {x: 0, y: i + 1};
                return d; });

            var nodes = self.axis_mapped_nodes(self.$C_elements
                                               .concat(self.$C_row_labels,
                                                       self.$C_column_labels));
            self.$grid.update_nodes(nodes, {resize: true,
                                            duration: duration, scale: false});
          }
          self.group_elements = function (duration) {
            self.most_recent_view = [self.group_elements, duration];
            var j = 1;
            var transitions = d3.range(self.$ccsC[1].length).map(
              function (i) {
                if (i == self.$ccsC[0][j]) { j++; return 1; } else { return 0; } });
            var y_positions = prefix_sum(transitions).map(
              function (d, i) { return d + i; });

            self.$C_row_labels = self.base_row_labels().map(
              function (d, i) { d.position = {x: 1, y: y_positions[i]}; return d; });
            self.$C_column_labels = self.base_column_labels().map(
              function (d, i) { d.position = {x: 2, y: y_positions[i]}; return d; });
            self.$C_elements = self.base_elements().map(
              function (d, i) {
                d.position = {x: 0, y: y_positions[i]};
                return d; });
            var nodes = self.axis_mapped_nodes(self.$C_elements
                                               .concat(self.$C_row_labels,
                                                       self.$C_column_labels));
            self.$grid.update_nodes(nodes, {resize: true, scale: false,
                                            duration: duration}).each(
              'end', function (d, i) {
                if (i == 0) { self.$grid.$dsvg.zoom_to_fit(800); }});
          }
          self.reduce_elements = function (element_nodes, settings) {
            var settings = (typeof settings == "undefined") ? {} : settings;
            var duration = ('duration' in settings) ? settings.duration : 800;
            var edge_type = (('edge_type' in settings) ? settings.edge_type
                             : 'auto');
            var single_edge = (edge_type == 'auto') ? false : edge_type;

            var $all_nodes = self.$C_elements.concat(self.$C_row_labels,
                                                     self.$C_column_labels);
            var $extent = {x: d3.extent(element_nodes.map(
                             function (d) { return d.position.x; })),
                           y: d3.extent(element_nodes.map(
                             function (d) { return d.position.y; }))};
            var $reduced_node = {key: ['reduce'].concat(element_nodes.map(
                                   function (d) { return d.key; })),
                                 label: '', type: '.reduction'};
            var $delta = {x: Math.abs($extent.x[0] - $extent.x[1]),
                          y: Math.abs($extent.y[0] - $extent.y[1])};

            if (edge_type == 'rectilinearx' ||
                (edge_type == 'auto' && $delta.x > $delta.y)) {
              $reduced_node.position = {x: $extent.x[0],
                                        y: $extent.y[0] - 2};
              edge_type = 'rectilinearx';
            } else if (edge_type == 'rectilineary' ||
                       (edge_type == 'auto' && $delta.x < $delta.y)) {
              $reduced_node.position = {x: $extent.x[0] - 2,
                                        y: $extent.y[0]};
              edge_type = 'rectilineary';
            } else {
              $reduced_node.position = {x: $extent.x[0],
                                        y: $extent.y[0]};
              edge_type = 'rectilineary';
            }
            $.extend($reduced_node.position, settings.position);
            element_nodes.map(
              function (d) {
                self.$grid.$grid.add_edge({x: d.position.x,
                                           y: d.position.y},
                                          {x: $reduced_node.position.x,
                                           y: $reduced_node.position.y},
                                          {type: edge_type}); });
            if ('on_reduce' in settings) {
              settings.on_reduce($reduced_node, element_nodes, $all_nodes);
            }
            var nodes = [$reduced_node];
            return self.$grid.update_nodes(nodes, {resize: false, scale: false,
                                                   duration: duration,
                                                   remove_missing: false});
          }

          /* # Sparse matrix column reduction #
           *
           * Steps:
           *
           *  - Display sparse matrix, $C$.
           *  - Label each in $C$ with the corresponding row index.
           *  - Spread the elements, such that each element has its own column.
           *  - Flatten the elements along with the corresponding row indexes
           *    and duplicate the column index label of each element to obtain
           *    the `COO` _(coordinate list)_ encoding of the sparse matrix.
           *  - Group elements by adding padding around elements from the same
           *    column.
           */

          // __NB__ `self.$cooC == numeric.ccsGather($ccsC)`
          self.clear_reductions = function (duration) {
            var duration = (typeof duration == "undefined") ? 0 : duration;
            self.$grid.$grid.clear_edges();
            var elements = self.$grid.$grid.$svg .selectAll('.reduction');
            if (!(duration == 0)) {
              return (elements.transition()
                      .duration(duration)
                      .style('opacity', 0)
                      .each('end', function (d) {
                        d3.select(this).remove(); }));
            } else {
              return elements.remove();
            }
          }

          self.column_reduce = function (settings) {
            self.clear_reductions();
            var $settings = {duration: 800,
                             position: {},
                             edge_type: ((self.$x_axis_type == 'rows')
                                         ? 'rectilinearx' : 'rectilineary')};
            $.extend($settings, settings);
            if (!('reduce' in $settings)) {
              $settings.reduce = function (a, b) { return a + b; };
            }
            var row_axis_extent = self.row_axis_extent();
            var column_axis_extent = self.column_axis_extent();
            if (row_axis_extent.dim == null) {
              $settings.position[self.row_dim()] = (column_axis_extent
                                                    .extent[0] - 2);
            }
            $settings.on_reduce = function (reduced_node, element_nodes) {
              var element_values = element_nodes.map(
                function (d) { return ('value' in d) ? d.value : d.label; });
              var reduced_value;
              if (element_values.length == 1) {
                reduced_value = element_values[0];
              } else {
                reduced_value = element_values.reduce($settings.reduce);
              }
              reduced_node.value = reduced_value;
              reduced_node.label = ((typeof reduced_value == 'number')
                                    ? +reduced_value.toFixed(2) : reduced_value);
            }
            d3.range(self.$ccsC[0].length - 1).map(
              function (i) {
                var nodes = (self.$grid.$grid.$svg
                             .selectAll('.node_group.element')
                             .filter(
                               function (d) { return d[self.$column_class] == i; }).data());
                self.reduce_elements(nodes, $settings);
              });
          }

          self.toggle_x_axis = function (duration) {
            if (self.$x_axis_type == 'rows') {
              self.$x_axis_type = 'columns';
            } else {
              self.$x_axis_type = 'rows';
            }
            if (self.most_recent_view != null) {
              var duration = ((typeof duration == "undefined")
                              ? self.most_recent_view[1] : duration);
              self.most_recent_view[0](duration);
            }
          }
      };
    });
    return plugin_context;
});
