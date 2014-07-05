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

    $(function() {
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

        window.$grid = (new dynamic_grid
                        .DynamicGrid(d3.select('.placement-grid > svg').node(),
                                     null, 10));
        window.set_block_count = function(logic_count) {
          window.$placement = new placement.Placement($grid, 0, logic_count);
          window.$placement.$grid.$grid.$svg.selectAll('text').style('opacity',
                                                                     0);
        }
        window.update_edges = function(edge_width) {
          ($placement.$grid.$grid.$svg.selectAll('.edge')
           .style('stroke-width', edge_width));
        }
        window.set_dimension = function(dimension) {
          $(".value.dimension").html(dimension);
          $(".slider.max-magnitude").slider('option', 'max', dimension - 1);
          $(".slider.max-magnitude").slider('value', dimension - 1);
          set_max_magnitude(dimension - 1);
          set_block_count(dimension * dimension);
          $placement.$grid.$grid.clear();
        }
        window.set_max_magnitude = function(max_magnitude) {
          $(".value.max-magnitude").html(max_magnitude);
        }
        $(".slider.edge-width").slider({
          min: 0,
          max: 5,
          value: 3,
          slide: function(event, ui) { update_edges(ui.value); },
        });
        $(".slider.dimension").slider({
          min: 4,
          max: 40,
          value: 12,
          slide: function(event, ui) { set_dimension(ui.value); },
          change: function(event, ui) { set_dimension(ui.value); }
        });
        $(".slider.max-magnitude").slider({
          min: 1,
          max: 10,
          value: 10,
          slide: function(event, ui) { set_max_magnitude(ui.value); },
          change: function(event, ui) { set_max_magnitude(ui.value); }
        });
        $(".value.dimension").html($(".slider.dimension").slider('value'));
        $(".value.max-magnitude").html($(".slider.max-magnitude")
                                       .slider('value'));
        $('button.propose-moves').click(function () {
          var max_distance = $(".slider.max-magnitude").slider('value');
          var moves = $placement.random_displacements({row: max_distance,
                                                       column: max_distance});
          $placement.propose_displacements(moves);
          var edge_width = $(".slider.edge-width").slider('value');
          update_edges(edge_width);
          //  p.$grid.$grid.$svg.selectAll('.edge').style('stroke-width', 1)
          var d_x = $placement.$d.$iterators.row.$magnitude;
          var s_x = $placement.$d.$iterators.row.$shift;
          var d_y = $placement.$d.$iterators.column.$magnitude;
          var s_y = $placement.$d.$iterators.column.$shift;
          $('.value.d-x').html(d_x);
          $('.value.s-x').html(s_x);
          $('.value.d-y').html(d_y);
          $('.value.s-y').html(s_y);
        });
        $('button.apply-moves').click(function () {
          $placement.apply_displacements();
        });
        set_dimension(10);
    });
});
