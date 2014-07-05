define(function (require) {
    // Load any app-specific modules
    // with a relative require call,
    // like:
    var messages = require('./messages');
    var jQuery = require('jquery');
    var $ = require('jquery');
    var d3 = require('d3');
    var d3_context = require('d3-context');
    var dynamic_svg = require('dynamic-svg');
    var grid = require('grid');
    var dynamic_grid = require('dynamic-grid');
    var permutation = require('permutation');
    var placement = require('placement');
    var dependent_moves_placer = require('dependent-moves-placer');
    var sparse_matrix = require('sparse-matrix');
    var _numeric = require('numeric');

    // Load library/vendor modules using
    // full IDs, like:
    var print = require('print');

    window.prefix_sum = function (array) {
      var sum = 0;
      return d3.range(array.length).map(
        function (i) { sum += array[i]; return sum; }); };

    print(messages.getHello());
    $(function() {
        window.$netlist = [{"block_key": 1, "net_key": 0},
                           {"block_key": 1, "net_key": 1},
                           {"block_key": 2, "net_key": 0},
                           {"block_key": 2, "net_key": 2},
                           {"block_key": 3, "net_key": 0},
                           {"block_key": 3, "net_key": 1},
                           {"block_key": 3, "net_key": 7},
                           {"block_key": 3, "net_key": 3},
                           {"block_key": 4, "net_key": 0},
                           {"block_key": 4, "net_key": 1},
                           {"block_key": 4, "net_key": 4},
                           {"block_key": 5, "net_key": 2},
                           {"block_key": 5, "net_key": 3},
                           {"block_key": 5, "net_key": 5},
                           {"block_key": 6, "net_key": 3},
                           {"block_key": 6, "net_key": 6},
                           {"block_key": 7, "net_key": 4},
                           {"block_key": 7, "net_key": 7},
                           {"block_key": 8, "net_key": 5},
                           {"block_key": 8, "net_key": 0},
                           {"block_key": 8, "net_key": 8},
                           {"block_key": 9, "net_key": 6},
                           {"block_key": 9, "net_key": 7},
                           {"block_key": 9, "net_key": 9},
                           {"block_key": 10, "net_key": 8},
                           {"block_key": 11, "net_key": 6},
                           {"block_key": 12, "net_key": 9}];
        window.foo = dynamic_svg.auto_register();
        window.d3 = d3;
        window.d3_context = d3_context;
        window.grid = grid;
        window.dynamic_svg = dynamic_svg;
        window.dynamic_grid = dynamic_grid;
        window.permutation = permutation;
        window.placement = placement;
        window.dependent_moves_placer = dependent_moves_placer;
        window.sparse_matrix = sparse_matrix;
        /* # Sparse matrix column reduction #
         *
         * Steps:
         *
         *  - Display node/edge _(i.e., block/net)_ adjacency matrix, $C$.
         *  - Label each `1` in $C$ with the corresponding block index.
         *  - Spread the `1` element elements, such that each element has
         *    its own column.
         *  - Flatten the `1` elements along with the corresponding block
         *    indexes and duplicate the net index label of each element to
         *    obtain the $COO$ _(coordinate list)_ encoding of the sparse
         *    matrix.
         *  - Group elements by add padding around elements from the same
         *    column _(i.e., net)_.
         */


        //var net_count = $matrix.$ccsC[0].length - 1;
        // __NB__ `window.$cooC == numeric.ccsGather($ccsC)`
        window.register_buttons = function (placer) {
          /* Register buttons to trigger actions on provided `placer`. */
          placer.view_operations().map(function (op) {
            /* Replace underscores with dashes for CSS class names. */
            var css_class = op.split('_').join('-');
            $('button.' + css_class).click(
              function () { placer[op](); }); });
        }

        window.$p = (new dependent_moves_placer
                 .DependentMovesPlacer($netlist,
                                       new dependent_moves_placer.StarPlus(),
                                       d3.select('.grid-table-placement')));
        $('button.propose-moves').click(function () { $p.propose_moves(); });
        //$p.reset_matrix($p.current_elements())
        //register_buttons($p);
    });
});
