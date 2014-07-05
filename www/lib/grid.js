define(function (require) {
    var $ = require('jquery');
    var d3 = require('d3');

    /**
     * Randomize array element order in-place.
     * Using Fisher-Yates shuffle algorithm.
     */
    function shuffle(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    /**
     * Returns a random integer between min (inclusive) and max (inclusive)
     * Using Math.round() will give you a non-uniform distribution!
     */
    /* http://stackoverflow.com/questions/1527803/generating-random-numbers-in-javascript-in-a-specific-range */
    function randint(min, max) {
      var temp = (typeof max == "undefined") ? min : max;
      var min = (typeof max == "undefined") ? 0 : min;
      max = temp;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function choice(array, sample_count, settings) {
      var settings = (typeof settings == "undefined") ? {} : settings;
      var replacement = ('replacement' in settings) ? settings.replacement : false;
      sample_count = Math.min(sample_count, array.length)
      if (!replacement) {
        shuffle(array);
        var output = [];
        for (var i = 0; i < sample_count; i++) {
          output.push(array[i]);
        }
        return output;
      } else {
        var output = [];
        for (var i = 0; i < sample_count; i++) {
          output.push(array[randint(array.length)]);
        }
        return output;
      }
    }

    var Diagonal = function(transform, d) {
        /* This class generates SVG path strings connecting a source position
         * to a target position.
         *
         * ## `transform` ##
         *
         * A `transform` function may be provided, which should map the
         * `source` and `target` positions into the SVG drawing space.  The
         * default `transform` function simply uses the `source` and `target`
         * coordinates as provided.  A user-specified `transform` function may
         * be used to scale/translate coordinates.
         *
         * ## `d` ##
         *
         * A function that will return an SVG `path` string, describing a
         * connection between the source and target.  The default `d` function
        * simply returns a straight-line path between the source and target. */
        var self = this;

        if (typeof(d) != "undefined") { self.d = d; }
        else {
            self.d = function () {
                var coords = self.get_svg_coords();
                path_text = ("M" + coords.source.x + "," + coords.source.y +
                             " " + coords.target.x + "," + coords.target.y);
                return path_text;
            }
        }

        if (typeof(transform) == "undefined") {
            this.$transform = function (coords) { return coords; }
        } else {
            this.$transform = transform;
        }

        this.transform = function(transform) {
            if (typeof(transform) != "undefined") {
              self.$transform = transform;
              return self;
            } else {
              return self.$transform;
            }
        }

        this.source = function(source) {
            if (typeof(source) != "undefined") {
              self.$source = source;
              return self;
            } else {
              return self.$source;
            }
        }

        this.target = function(target) {
            if (typeof(target) != "undefined") {
              self.$target = target;
              return self;
            } else {
              return self.$target;
            }
        }

        this.get_svg_coords = function () {
          var coords = {source: self.transform()(self.source()),
                        target: self.transform()(self.target())};
          return coords;
        }
    };

    var Rectilinear = function(transform) {
      /* This class is a specialization of the `Diagonal` class, which draws
       * rectilinear connecting lines to help differentiate overlapping paths. */
      var self = this;
      self.$direction = "x";

      self.direction = function(direction) {
        if (typeof direction == "undefined") {
          return self.$direction;
        }
        self.$direction = direction;
        return self;
      }
      var d = function () {
        var coords = self.get_svg_coords();
        var mid = {x: (.5 * Math.abs(coords.target.x - coords.source.x) +
                       Math.min(coords.target.x, coords.source.x)),
                   y: (.5 * Math.abs(coords.target.y - coords.source.y) +
                       Math.min(coords.target.y, coords.source.y))};

        if (self.direction() == "x") {
          path_text = ("M" + coords.source.x + "," + coords.source.y + " "
                       + mid.x + "," + coords.source.y + " "
                       + mid.x + "," + coords.target.y + " "
                       + coords.target.x + "," + coords.target.y);
        } else {
          path_text = ("M" + coords.source.x + "," + coords.source.y + " "
                       + coords.source.x + "," + mid.y + " "
                       + coords.target.x + "," + mid.y + " "
                       + coords.target.x + "," + coords.target.y);
        }
        return path_text;
      }
      $.extend(self, new Diagonal(transform, d));
    };

    var Curve = function(transform) {
        /* This class is a specialization of the `Diagonal` class, which draws
         * curved connecting lines to help differentiate overlapping paths. */
        var self = this;
        var d = function () {
            var coords = self.get_svg_coords();
            if (self.source().y != self.target().y &&
                self.source().x != self.target().x) {
              var path_text = d3.svg.diagonal()
                                .source(coords.source)
                                .target(coords.target)();
            } else {
              /* The source and target share the same row or column.  Use
               * an arc to connect them rather than a diagonal.  A diagonal
               * degrades to a straight line in this case, making it
               * difficult to distinguish overlapping links. */
              var dx = coords.target.x - coords.source.x;
              var dy = coords.target.y - coords.source.y;
              var dr = Math.sqrt(dx * dx + dy * dy);

              if (self.source().y == self.target().y
                  && self.source().x % 2 == 0) {
                flip = 1;
              } else if (self.source().x == self.target().x
                         && self.source().y % 2 == 0) {
                flip = 1;
              } else {
                flip = 0;
              }
              path_text = ("M" + coords.source.x + "," + coords.source.y +
                           "A" + dr + "," + dr + " 0 0," + flip + " " +
                           coords.target.x + "," + coords.target.y);
            }
            return path_text
        }
        $.extend(self, new Diagonal(transform, d));
    };

    var plugin_context = {
        Diagonal: Diagonal,
        Rectilinear: Rectilinear,
        Curve: Curve,
        Grid: function(svg_element) {
            var self = this;
            self.most_recent = {};

            this.$svg = d3.select(svg_element);

            this.$diagonal = new Diagonal(function(position) {
                return {x: self.node_center(position).y,
                        y: self.node_center(position).x};
            });

            this.$rectilinearx = new Rectilinear(function(position) {
                return {x: self.node_center(position).y,
                        y: self.node_center(position).x};
            });
            this.$rectilinearx.direction("x");

            this.$rectilineary = new Rectilinear(function(position) {
                return {x: self.node_center(position).y,
                        y: self.node_center(position).x};
            });
            this.$rectilineary.direction("y");

            this.$curve = new Curve(function(position) {
                return {x: self.node_center(position).y,
                        y: self.node_center(position).x};
            });

            this.$node_scale = {width: 0.8, height: 0.8};

            this.$width = null;
            this.$height = null;

            this.resize = function (size) {
                var size = (typeof size == "undefined") ? {} : size;

                /* Automatically determine width or height, if the
                * corresponding value is not specified.
                *
                * Automatic detection is done by traversing up through the
                * parent _(i.e., containing)_ elements until a parent is found
                * with the respective dimension extent defined. */
                ['width', 'height'].map(function (dimension) {
                    if (!(dimension in size)) {
                        var container = self.$svg.node();
                        size[dimension] = null;
                        while (size[dimension] == null) {
                            var dim_size = parseInt(d3.select(container)
                                                    .style(dimension));
                            if (dim_size == dim_size) {
                                /* The dimension size is defined. */
                                size[dimension] = dim_size;
                                break;
                            }
                            container = container.parentNode;
                            if (container == null) { break; }
                        }
                    }
                });
                self.$width = size.width;
                self.$height = size.height;
                //Define Scale
                self.$scale = {'x': d3.scale.linear().range([self.$height, 0]),
                               'y': d3.scale.linear().range([0, self.$width])}
                return size;
            }

            this.node_group_height = function() {
                var result = ((self.$scale.x.range()[0] -
                               self.$scale.x.range()[1]) /
                              (self.$scale.x.domain()[1] -
                               self.$scale.x.domain()[0]));
                return result;
            }

            this.node_group_width = function() {
                var result = ((self.$scale.y.range()[1] -
                               self.$scale.y.range()[0]) /
                              (self.$scale.y.domain()[1] -
                               self.$scale.y.domain()[0]));
                return result;
            }

            this.node_width = function() {
                var result = self.$node_scale.width * self.node_group_width();
                return result;
            }

            this.node_height = function() {
                var result = self.$node_scale.height * self.node_group_height();
                return result;
            }

            this.node_center = function(position) {
                svg_position = self.node_position(position);
                svg_position.x += .5 * self.node_group_height();
                svg_position.y += .5 * self.node_group_width();
                return svg_position;
            }

            this.node_position = $.proxy(function(d) {
                var position =  {'x': this.$scale.x(d.x),
                                 'y': this.$scale.y(d.y - 1)};
                return position;
            }, this);

            this.nodes = function() {
                return self.$svg.selectAll('.node_group').data();
            }

            this.update_nodes = function(nodes, settings) {
                if (typeof nodes == "undefined") {
                    nodes = self.$svg.selectAll(".node_group").data();
                    if (nodes.length == 0) return;
                }
                var settings = (typeof settings == "undefined") ? {} : settings;
                var duration = ('duration' in settings) ? settings.duration : 600;
                var scale = ('scale' in settings) ? settings.scale : true;
                var remove_missing = (('remove_missing' in settings)
                                      ? settings.remove_missing : true);

                if (scale) {
                  self.$scale.x.domain([d3.min(nodes,
                                               function(d) {
                                                   return d.position.x;
                                               }) - 1,
                                        d3.max(nodes,
                                               function(d) {
                                                   return d.position.x;
                                               })]);
                  self.$scale.y.domain([d3.min(nodes,
                                               function(d) {
                                                   return d.position.y;
                                               }) - 1,
                                        d3.max(nodes,
                                               function(d) {
                                                   return d.position.y;
                                               })]);
                }
                var node_groups = self.$svg.selectAll(".node_group")
                  .data(nodes, function(d) { return d.key; });

                var new_node_groups = node_groups.enter()
                  .append("svg:g").attr("class", "node_group")
                    .attr("class", function(d, i) {
                      var class_ = "node_group " + i;
                      var block_type = '';
                      if (typeof(d.type) != "undefined") {
                          block_type = d.type.substr(1, d.type.length - 1);
                      }
                      class_ +=  " " + block_type;
                      if (typeof(d.sync) != "undefined" && d.sync) {
                          class_ +=  " sync";
                      }
                      return class_;
                    });

                new_node_groups.append("svg:rect")
                    .on("mouseover", function(d) {
                        d3.select(this).classed('hover', true);
                    })
                    .on("mouseout", function(d) {
                        d3.select(this).classed('hover', false);
                    })
                    .on("click", function(d) {
                      /* TODO:
                       *
                       * # `alt`-key: select new target #
                       *
                       * If `alt` key is active and there are two nodes
                       * currently selected, de-select most recently selected
                       * node and select the currently clicked node.  This
                       * makes it easy to select an alternate target for the
                       * origin of an existing edge. */
                      var state = (d3.select(this.parentNode)
                                   .classed('selected'));
                      d3.select(this.parentNode).classed('selected', !state);
                      var edge_settings = {};
                      if (d3.event.shiftKey) {
                        edge_settings.type = 'diagonal';
                      } else {
                        edge_settings.type = 'curve';
                      }

                      if (d3.event.ctrlKey && d3.event.altKey
                          && 'click' in self.most_recent) {
                        var node_parent = d3.select(self.most_recent.click
                                                  .element.parentNode);
                        if (node_parent.classed('selected')) {
                          node_parent.classed('selected', false);
                        }
                      }

                      var nodes = self.$svg.selectAll('.selected').data();

                      if (!d3.event.ctrlKey) {
                        self.clear_edges();
                      }
                      if (nodes.length == 2) {
                        /* Concatenate node position strings to create an edge
                         * selector.  This allows us to check if there is already
                         * an edge connecting the two selected nodes. */
                        var edge_class = '.edge' + nodes.map(function (d) {
                          return '.x' + d.position.x + 'y' + d.position.y;
                        }).reduce(function (a, b) { return a + b; });

                        var edges = self.$svg.selectAll(edge_class);

                        if (edges.node() == null) {
                          /* There is no edge currently connecting the two
                           * selected nodes. */
                          self.add_edge(nodes[0].key, nodes[1].key,
                                        edge_settings);
                        }
                      }
                      self.most_recent.click = {element: this, node: d};
                    })
                    .attr("class", "node");

                new_node_groups.append("text")
                    .attr("font-family", "sans-serif")
                    .attr("text-anchor", "middle")
                    .attr("class", "node_label");
                node_groups.select('text').text(
                  function (d) {
                    if ('label' in d) {
                      return d.label;
                    } else {
                      return d.key;
                    }
                  });

                self.$svg.selectAll(".node")
                    .transition()
                    .duration(duration)
                    .ease("cubic-in-out")
                    .attr("height", function() { return self.node_height(); })
                    .attr("width", function() { return self.node_width(); })
                    .attr("transform", function(d) {
                        var x_padding = 0.5 * (self.node_group_height() - self.node_height());
                        var y_padding = 0.5 * (self.node_group_width() - self.node_width());
                        return "translate(" + y_padding + "," + x_padding + ")";
                    });

                self.$svg.selectAll(".node_group text.node_label")
                    .transition()
                    .duration(duration)
                    .ease("cubic-in-out")
                    .attr("x", function(d) {
                      return .5 * self.node_group_width();
                    })
                    .attr("y", function(d) {
                      var font_size = parseInt(d3.select(this)
                                               .style('font-size'));
                      return .5 * self.node_group_height() + .4 * font_size;
                    });

                var move_transition = self.$svg.selectAll(".node_group")
                      .transition()
                      .duration(duration)
                      .ease("cubic-in-out")
                      .attr("transform", $.proxy(function(d) {
                        var position = self.node_position(d.position);
                        return "translate(" + position.y + "," + position.x + ")";
                      }, self))
                      .each('end', function (d, i) {
                        if ('on_end' in settings && i == 0) {
                            settings['on_end']();
                        }
                      });

                if (remove_missing) {
                  node_groups.exit().remove();
                }

                return move_transition;
            }

            this.resize_text = $.proxy(function (font_size) {
                this.$svg.selectAll("text").attr('font-size', font_size);
            }, this);

            this.nodes_by_key = $.proxy(function () {
                var nodes = {};
                this.$svg.selectAll('.node_group')
                    .each(function(d) {
                        nodes[d.key] = d;
                    });

                return nodes;
            }, this);

            this.clear_edges = $.proxy(function () {
                this.$svg.selectAll('path.edge').remove();
            }, this);

            this.remove_edge = $.proxy(function (a, b) {
                var nodes;
                if (typeof a == "number" || typeof b == "number") {
                    nodes = this.nodes_by_key();
                }
                if (typeof a == "number") {
                    a = nodes[a];
                }
                if (typeof b == "number") {
                    b = nodes[b];
                }
                var edge = this.$svg.selectAll('path' + '.x' + a.x + 'y' + a.y
                                               + '.x' + b.x + 'y' + b.y).remove();
            }, this);

            this.add_edge = function (a, b, settings) {
                var nodes;
                var settings = (typeof settings == "undefined") ? {} : settings;

                if (typeof a == "number" || typeof b == "number") {
                    nodes = self.nodes_by_key();
                }
                if (typeof a == "number") {
                    a = nodes[a].position;
                }
                if (typeof b == "number") {
                    b = nodes[b].position;
                }
                var edge = self.$svg.append('path')
                    .attr('class', 'edge '
                          + ' x' + a.x + 'y' + a.y
                          + ' x' + b.x + 'y' + b.y)
                    .on('click', function(d) {
                      if (d3.event.ctrlKey) {
                        d3.select(this).remove();
                      }
                    });
                var type = ("type" in settings) ? settings.type : "curve";
                edge.attr('d', self['$' + type].source(a).target(b).d());
                edge.classed(type, true);
                var start_opacity = edge.style('opacity');
                edge.style('opacity', 0);
                return edge.transition().style('opacity', start_opacity);
            }

            this.nodes_by_position = function () {
                var nodes = d3.map();
                self.$svg.selectAll('.node_group')
                    .each(function (d) {
                        nodes.set([d.position.x, d.position.y], d);
                    });
                return nodes;
            }

            this.query_positions = function (positions) {
                var nodes = self.nodes_by_position();
                return positions.map(function (p) {
                    if (nodes.has([p.x, p.y])) {
                        return nodes.get([p.x, p.y]);
                    } else {
                        return null;
                    }
                });
            }

            this.query_nodes = function (node_keys) {
                var key_set = d3.set(node_keys);
                var that = self;
                var nodes = self.$svg.selectAll('.node_group')
                  .filter(function(d) {
                      return key_set.has(d.key);
                  }).data();

                return nodes;
            }

            this.nodes_bbox = $.proxy(function (node_keys, margin) {
                /* Return the bounding-box containing the specified nodes. */
                var key_set = d3.set(node_keys);
                var INF = 1000000;
                margin = (typeof(margin) == "undefined") ? 0 : margin;
                var bbox = {min: {x: INF, y: INF},
                            max: {x: 0, y: 0}};
                var that = this;
                this.$svg.selectAll('.node_group')
                    .each(function(d) {
                        /* Expand the bounding-box to include nodes that were
                         * in the specified set. */
                        if (key_set.has(d.key)) {
                            var b = d3.select(this).node().getBBox();
                            b.x += self.node_position(d.position).y;
                            b.y += self.node_position(d.position).x;
                            bbox.min.x = Math.min(bbox.min.x, b.x);
                            bbox.min.y = Math.min(bbox.min.y, b.y);
                            bbox.max.x = Math.max(bbox.max.x, b.x + b.width);
                            bbox.max.y = Math.max(bbox.max.y, b.y + b.height);
                        }
                    });

                return {x: (bbox.min.x < INF) ? bbox.min.x - margin : 0,
                        y: (bbox.min.y < INF) ? bbox.min.y - margin : 0,
                        width: Math.max(0, bbox.max.x - bbox.min.x + 2 *
                                        margin),
                        height: Math.max(0, bbox.max.y - bbox.min.y + 2 *
                                         margin)};
            }, this);

            this.swap = $.proxy(function (a_key, b_key) {
                /* Swap the position of the specified nodes.
                 *
                 * Return `d3` move transition, to allow further chaining.  For
                 * example, to execute code upon completion of swap:
                 *
                 *     my_grid.swap(1, 4).each('end', function (d, i) {
                 *         if (i == 0) {
                 *             // Code to run after swap has completed...
                 *         }
                 *     });
                 * */
                var nodes;
                if (typeof a_key != "number" && typeof b_key == "undefined") {
                  /* Assume that we were passed an array of two elements to
                   * swap locations. */
                  if (a_key.length != 2) {
                    throw "Swap assumes an array of length 2.";
                  }
                  if (typeof a_key[0] == "number") {
                    /* Assume the entries of the array are node keys. */
                    nodes = this.query_nodes([].concat(a_key));
                  } else {
                    /* Assume the entries of the array are node objects. */
                    nodes = a_key;
                  }
                } else {
                  nodes = this.query_nodes([a_key, b_key]);
                }
                var a = nodes[0];
                var b = nodes[1];
                var temp = {x: a.position.x, y: a.position.y};
                a.position.x = b.position.x;
                a.position.y = b.position.y;
                b.position.x = temp.x;
                b.position.y = temp.y;
                return this.update_nodes(this.$svg.selectAll('.node_group')
                                         .data());
            }, this);

            this.moved_nodes = function(nodes) {
              var nodes_by_key = d3.map(self.nodes_by_key());
              return nodes.filter(function (p) {
                if (nodes_by_key.has(p.key)) {
                  var original = nodes_by_key.get(p.key);
                  return (original.position.x != p.position.x ||
                          original.position.y != p.position.y);
                }
                return false;
              }).map(function (d) {
                return {source: nodes_by_key.get(d.key), target: d};
              });
            };

            this.moved_edges = function(nodes, settings) {
              self.clear_edges();
              var v = d3.map();
              self.moved_nodes(nodes).map(function (d) {
                var temp = [[d.source.position.x, d.source.position.y,
                             d.source],
                            [d.target.position.x, d.target.position.y,
                             d.target]].sort();
                v.set([temp[0][2].position.x, temp[0][2].position.y], d);
              });
              v.values().map(function (d) {
                self.add_edge(d.source.position, d.target.position, settings);
              });
              return v;
            }

            self.highlight_selected = function () {
              var bbox = self.nodes_bbox(self.$svg.selectAll('.selected')
                                         .data().map(
                                           function (d) { return d.key; }), 5);
              self.$svg.insert('rect', '.node_group')
                .attr('x', bbox.x).attr('y', bbox.y).attr('width', bbox.width)
                .attr('height', bbox.height).attr('class', 'bbox');
            }

            self.select_none = function () {
              self.$svg.selectAll('.selected').classed('selected', false);
              self.$svg.selectAll('.bbox').remove();
            }

            self.clear = function () {
              self.clear_edges();
              self.select_none();
            }

            this.resize();
        }
    }

    plugin_context.shuffle = shuffle;
    plugin_context.randint = randint;
    plugin_context.choice = choice;
    return plugin_context;
});
