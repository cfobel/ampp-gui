define(function (require) {
    var $ = require('jquery');
    var d3 = require('d3');
    var placement = require('placement');
    var _numeric = require('numeric');

    var plugin_context = {};
    plugin_context.identity = function (d) { return d.label; };
    plugin_context.square = function (d) { return d.label * d.label; };

    plugin_context.StarPlus = function () {
      /* # `StarPlus` #
       *
       * This class implements an API to compute:
       *
       *  - Edge vectors _($e_x$, $e_{x2}$, $r$, etc.)_, given the matrices
       *    $C$, $X$, and $Y$.
       *  - Net cost vector, $n_c$, given edge vectors.
       *  - Scalar cost of a single net in a single dimension. */
      var identity = plugin_context.identity;
      var square = plugin_context.square;
      var self = this;

      self.net_cost = function (d) {
        /* Where:
         *
         *  - `d[0]`: `e_xj`
         *  - `d[1]`: `e_x2j`
         *  - `d[2]`: `r_j` */
        return 0.59 * Math.sqrt(d[1] - (d[0] * d[0]) / d[2] + 1);
      }

      self.edge_vectors = function (matrices) {
        /* ## `vector_maps` ##
         *
         * Format:
         *  0. `elements` to reduce by net-key.
         *  1. Function to extract value from each element. */
        var vector_maps = {e_x: [matrices.X.$C_elements, identity],
                           e_x2: [matrices.X.$C_elements, square],
                           e_y: [matrices.Y.$C_elements, identity],
                           e_y2: [matrices.Y.$C_elements, square]};

        /* ## `vectors` ##
         *
         * For each mapping definition in `vector_maps`:
         *
         *  0. Group corresponding elements by net-key.
         *  1. Extract value from each element using corresponding map function.
         *  2. Reduce extracted values _(by net-key)_.
         *
         * After applying the reduction by net-key for each mapping definition in
         * `vector_maps`, the result is a dictionary of vectors, where each
         * vector contains a reduced value for each net. */
        var vectors = {};
        Object.keys(vector_maps).map(
          function (vector) {
            var vmap = vector_maps[vector];
            vectors[vector] = (d3.nest().key(function (d) { return d.net; })
                        .entries(vmap[0]).map(
                          function (v) {
                            return v.values.map(vmap[1]).reduce(
                              function (a, b) { return a + b; }); }));
          });

          return vectors;
      }

      self.net_cost_vector = function (r_vector, vectors) {
        /* ## `n_c_vector` ##
         *
         * Compute the cost of each net using the reduced vectors in `vectors`.
         */
        /* Where each edge-vector-set, `vectors`, is of the following form:
         *
         *  - `vectors[0]`: `e_?_vector`
         *  - `vectors[1]`: `e_?2_vector`
         *  - `vectors[2]`: `r_vector`
         *
         * Note that `?` denotes a dimension, _(e.g., `x` or `y`)_. */
        var dim_labels = {};
        (Object.keys(vectors)
         .map(function (k) { return k.match(/e_([^0-9]+)/); })
         .filter(function (v) { return (v != null); })
         .map(function (v) { dim_labels[v[1]] = 1; }));

        return numeric.add.apply(this, Object.keys(dim_labels).map(
          function (key) {
            var dim_vectors = [vectors['e_' + key], vectors['e_' + key + '2'],
                               r_vector];
            return d3.zip.apply(this, dim_vectors).map(
              function (d) { return self.net_cost(d); }); }));
      }
    }

    plugin_context.PlacerState = function (gui_root_d3, keys, r_vector,
                                           net_cost_model) {
      var self = this;

      self.$keys = keys;
      self.$matrix_labels = ['X', 'Y', 'V'];
      self.$matrix_grids = {};
      self.$matrix_values = {};
      self.$matrices = {};
      self.$r_vector = r_vector;
      self.$net_cost_model = net_cost_model;
      self.$gui_root_d3 = gui_root_d3;
      self.$p_x = (new dynamic_grid
                   .DynamicGrid(self.$gui_root_d3
                                .select('.vector-px-grid > svg')
                                .node(), null, 10));
      self.$p_y = (new dynamic_grid
                   .DynamicGrid(self.$gui_root_d3
                                .select('.vector-py-grid > svg')
                                .node(), null, 10));
      self.$default_duration = 1000;

      self.$matrix_labels.map(
        function (label, i) {
          self.$matrix_grids[label] = (new dynamic_grid
                                      .DynamicGrid(self.$gui_root_d3
                                                   .select('.matrix-' + label +
                                                           '-grid > svg')
                                                   .node(), null, 10));
          self.$matrix_values[label] = function (t) {
            return function (d) {
              return d.position[t.toLowerCase()];
            }
          }(label); });
      self.$matrix_values.V = null;

      self.reset_matrix = function (elements, positions) {
        /* # `reset_matrix` #
         *
         * Update the elements of each matrix instance _($X$, $Y$, $V$)_ to
         * match the specified position elements _(in the form returned by
         * `current_elements` or `proposed_elements`)_. */
        self.$matrix_labels.map(
          function (label, i) {
            /* Use `self.$matrix_values[label]` callback function to extract the
             * value from each element that corresponds to `label`.
             *
             * For example, for the label `X`, we want to extract the
             * `x`-coordinate of the position of the element. */
            if (self.$matrix_values[label]) {
              var $cooC = [self.$keys[0], self.$keys[1],
                           elements.map(self.$matrix_values[label])];
              var grid = self.$matrix_grids[label];
              self.$matrices[label] = new sparse_matrix.SparseMatrix(grid, $cooC,
                                                                    'block',
                                                                    'net');
            }
          });

        self.$p_x.update_nodes(positions.map(
          function (d, i) {
            var x = d.position.x;
            return {key: i, label: x, position: {x: 0, y: i}};
          }));
        self.$p_y.update_nodes(positions.map(
          function (d, i) {
            var y = d.position.y;
            return {key: i, label: y, position: {x: 0, y: i}};
          }));
        self.display_elements();

        /*  - Compute cost of each net. */
        var net_cost_vector = self.net_cost_vector(self.$matrices);

        /*  - Populate $V$ matrix with net cost corresponding to each element.
        *  */
        var $cooC = [self.$keys[1], self.$keys[0],
                     self.$keys[1].map(
                       function (d) { return net_cost_vector[d]; })];
        var grid = self.$matrix_grids.V;
        self.$matrices.V = new sparse_matrix.SparseMatrix(grid, $cooC, 'net',
                                                          'block');
        self.$matrices.V.display_elements(self.$default_duration);
        self.$matrices.V.toggle_x_axis();
        self.column_reduce();
        self.zoom_to_fit();
      }

      self.net_cost_vector = function (matrices) {
        /* # `cost` #
         *
         * Return net-cost vector $\vec{n_c}$ of net-list based on the provided
         * matrices, $C$, $X$, and $Y$. */
        var m = self.$net_cost_model;
        return self.$net_cost_model.net_cost_vector(self.$r_vector,
                                                    self.$net_cost_model
                                                    .edge_vectors(matrices));
      }

      /* # View methods #
      *
      * Add methods for displaying, flattening, and reducing $X$, and $Y$.
      * */
      self.$view_operation_args = {display_elements: [self.$default_duration],
                                   label_elements: [self.$default_duration],
                                   spread_elements: [self.$default_duration],
                                   flatten_elements: [self.$default_duration],
                                   toggle_x_axis: [self.$default_duration],
                                   clear_reductions: [],
                                   group_elements: [self.$default_duration],
                                   column_reduce: [function (a, b) {
                                                     return a + b; }]}

      self.zoom_to_fit = function () {
        Object.keys(self.$matrices).map(function (label) {
          self.$matrices[label].$grid.zoom_to_nodes();
        })
      }

      self.select_none = function () {
        Object.keys(self.$matrices).map(function (label) {
          self.$matrices[label].$grid.$grid.$svg.selectAll('.selected')
            .classed('selected', false);
          self.$matrices[label].$grid.$grid.$svg.selectAll('.bbox').remove();
        })
        self.$placement.$grid.$grid.$svg.selectAll('.selected')
          .classed('selected', false);
      }

      self.view_operations = function () {
        return (Object.keys(self.$view_operation_args)
                .concat(['zoom_to_selected', 'zoom_to_fit',
                         'highlight_selected', 'select_none']));
      }

      Object.keys(self.$view_operation_args).map(function (op) {
        self[op] = function () {
          Object.keys(self.$matrices).map(function (label) {
            var args = self.$view_operation_args[op];
            self.$matrices[label][op].apply(this, args);
          });
        };
      });
    }

    plugin_context.DependentMovesPlacer = function (netlist, net_cost_model,
                                                    gui_root_d3) {
      var self = this;

      self.$gui_root_d3 = gui_root_d3;
      self.$net_cost_model = net_cost_model;
      self.$keys_T = $netlist.map(function(d, i) {
                                      return [d.block_key, d.net_key]; });
      self.$keys = d3.range(2).map(function (i) {
                                       return self.$keys_T.map(
                                         function (d) { return d[i]; }) });
      self.$block_count = Object.keys(d3.nest().key(
        function (d) { return d; }).map(self.$keys[0])).length;

      var cooC = [self.$keys[0], self.$keys[1],
                  d3.range(self.$keys[0].length)
                  .map(function () { return 1; })];
      var C_grid = (new dynamic_grid
                    .DynamicGrid(self.$gui_root_d3
                                 .select('.matrix-C-grid > svg')
                                 .node(), null, 10));
      self.$C = new sparse_matrix.SparseMatrix(C_grid, cooC,
                                               'block', 'net');
      self.$C.display_elements(1000);
      self.$C.$grid.zoom_to_nodes();

      /* Display reduced columns of $C$, which correspond to the number of
       * blocks connected to each net. */
      self.$C.column_reduce();
      self.$C.$grid.zoom_to_nodes();

      self.$G_grid = (new dynamic_grid
                      .DynamicGrid(self.$gui_root_d3
                                   .select('.matrix-G-grid > svg')
                                   .node(), null, 10));

      self.$S_grid = (new dynamic_grid
                      .DynamicGrid(self.$gui_root_d3
                                   .select('.matrix-S-grid > svg')
                                   .node(), null, 10));

      self.$r_vector = (d3.nest().key(function (d) { return d.net; })
                        .entries(self.$C.$C_elements).map(
                          function (v) {
                            return v.values.map(plugin_context.identity)
                            .reduce(function (a, b) { return a + b; }); }));

      var placement_grid = (new dynamic_grid
                            .DynamicGrid(self.$gui_root_d3
                                         .select('.placement-grid > svg')
                                         .node(), null, 10));
      self.$placement = new placement.Placement(placement_grid, 0,
                                                self.$block_count);
      self.$states = {};
      ['current', 'proposed'].map(
        function (label) {
          self.$states[label] = (new dependent_moves_placer
                                 .PlacerState(d3.select('.grid-table-' +
                                                        label),
                                              self.$keys, self.$r_vector,
                                              self.$net_cost_model)); });

      self.propose_moves = function () {
        /*  - Propose new set of moves. */
        self.$placement.propose_displacements();
        var positions = {current: self.$placement.$positions,
                         proposed: self.$placement.$new_positions};
        /*  - Update matrix displays based on the current set of proposed
         *    moves. */
        ['current', 'proposed'].map(
          function (label) {
            var elements_func = self[label + '_elements'];
            self.$states[label].reset_matrix(elements_func(),
                                             positions[label]); });
        var $cooG = [[], [], []];
        Object.keys(self.$placement.$dependent_groups).map(
          function (group_key, i) {
            var group = self.$placement.$dependent_groups[group_key];
            self.$placement.$permutation.$node_slot_keys.map(
              function (slot_key, node_key) {
                if (node_key in group) {
                  $cooG[0].push(node_key);
                  $cooG[1].push(i);
                  $cooG[2].push(1);
                } }); });
            self.$G = new sparse_matrix.SparseMatrix(self.$G_grid, $cooG,
                                                     'block', 'group');
            self.$G.display_elements(1000, {});
        var $b = {};
        ['current', 'proposed'].map(
          function (label) {
            var state = self.$states[label];
            $b[label] = (state.$matrices.V.$grid.$grid.$svg
                         .selectAll('.reduction').data().map(
                           function (d) { return d.value; })); });
        var $b_delta = numeric.sub($b.proposed, $b.current);
        var $cooS = [self.$G.$cooC[0], self.$G.$cooC[1],
                     d3.zip(self.$G.$cooC[0]).map(
                       function (block_key) { return $b_delta[block_key]; })];
        self.$S = new sparse_matrix.SparseMatrix(self.$S_grid, $cooS, 'block',
                                                 'group');
        self.$S.display_elements(100);
        self.$S.column_reduce();
        self.$S.$grid.zoom_to_nodes();
        self.$S.$grid.$grid.$svg.selectAll('.reduction')
           .classed('reduction', false)
           .classed('assessed', true)
           .classed('accepted', function (d) { return d.value <= 0; })
         .selectAll('rect').attr('rx', 15).attr('ry', 15);
      }

      self.current_elements = function () {
        /* # `current_elements` #
         *
         * Return list of position elements based on the _current_ placement,
         * where each corresponds to an $x_{ij}$/$y_{ij}$ element. */
        return d3.zip(self.$keys[0], self.$keys[1]).map(
          function (d) {
            var keys = {block_key: d[0], net_key: d[1]};
            return self.$placement.$positions[keys.block_key]; });
      }

      self.proposed_elements = function () {
        /* # `proposed_elements` #
         *
         * Return list of position elements based on the _proposed_ placement,
         * where each corresponds to an $x_{ij}$/$y_{ij}$ element. */
        return d3.zip(self.$keys[0], self.$keys[1]).map(
          function (d) {
            var keys = {block_key: d[0], net_key: d[1]};
            return self.$placement.$new_positions[keys.block_key]; });
      }
    };

    return plugin_context;
});
