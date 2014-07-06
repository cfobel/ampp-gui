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
          $(".slider.ampp-distance").slider('option', 'max', dimension - 1);
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
        $(".slider.ampp-param").slider({
          min: 0,
          max: 10,
          value: 0,
          change: function (event, ui) {
            var input = $(event.target.parentElement
                          .nextElementSibling).find('input');
            input.val(ui.value);
          },
          slide: function(event, ui) {
            var input = $(event.target.parentElement
                          .nextElementSibling).find('input');
            input.val(ui.value);
            var params = get_ampp_params();
            var max_shift = {x: ((params.l_x > 2 * params.d_x)
                                 ? 2 * params.d_x - 1 : params.l_x - 2),
                             y: ((params.l_y > 2 * params.d_y)
                                 ? 2 * params.d_y - 1 : params.l_y - 2)};
            /* Increase by one to show pattern repeating/out-of-bounds. */
            max_shift.x++;
            max_shift.y++;
            var value = {x: Math.min(params.s_x, max_shift.x),
                         y: Math.min(params.s_y, max_shift.y)};
            value.x = Math.max(0, value.x);
            value.y = Math.max(0, value.y);
            $('.slider.ampp-shift-x').slider('value', value.x);
            $('.slider.ampp-shift-x').slider('option', 'max', max_shift.x);
            $('.slider.ampp-shift-y').slider('value', value.y);
            $('.slider.ampp-shift-y').slider('option', 'max', max_shift.y);
            propose_moves();
          }
        });
        $(".value.dimension").html($(".slider.dimension").slider('value'));
        $(".value.max-magnitude").html($(".slider.max-magnitude")
                                       .slider('value'));
        $('button.propose-moves').click(function () {
          var max_distance = $(".slider.max-magnitude").slider('value');
          var moves = $placement.random_displacements({row: max_distance,
                                                       column: max_distance});
          var d_x = moves.$iterators.row.$magnitude;
          var s_x = moves.$iterators.row.$shift;
          var d_y = moves.$iterators.column.$magnitude;
          var s_y = moves.$iterators.column.$shift;
          $('.value .d-x').val(d_x);
          $('.value .s-x').val(s_x);
          $('.value .d-y').val(d_y);
          $('.value .s-y').val(s_y);
          propose_moves();
        });
        window.propose_moves = function () {
          var ampp_params = get_ampp_params();
          var moves = ($placement.$permutation
                       .displacements({row: ampp_params.d_x,
                                       column: ampp_params.d_y},
                                      {row: ampp_params.s_x,
                                       column: ampp_params.s_y},
                                       $placement.$s2p));
          $placement.propose_displacements(moves);
          var edge_width = $(".slider.edge-width").slider('value');
          update_edges(edge_width);
        }
        window.get_ampp_params = function () {
          return {d_x: +$('.value .d-x').val(),
                  s_x: +$('.value .s-x').val(),
                  d_y: +$('.value .d-y').val(),
                  s_y: +$('.value .s-y').val(),
                  l_x: $(".slider.dimension").slider('value'),
                  l_y: $(".slider.dimension").slider('value')};
        }
        $('button.apply-moves').click(function () {
          $placement.apply_displacements();
        });
        $(".slider.dimension").slider('value', 12),
        set_dimension(12);
    });
});
