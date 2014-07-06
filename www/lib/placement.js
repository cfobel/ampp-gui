define(function (require) {
  var $ = require('jquery');
  var d3 = require('d3');
  var permutation = require('permutation');

  var plugin_context = {};

  plugin_context.Placement = function (grid, io_count, logic_count) {
    var self = this;

    function clipped_slot_key(slot_key, d) {
      var new_slot_key = slot_key + d;
      return new_slot_key;
    }

    self.$grid = grid;
    self.$s2p = new permutation.vpr_auto_slot_key_to_position(io_count,
                                                              logic_count);
    self.$io_count = io_count;
    self.$logic_count = logic_count;
    self.$block_count = logic_count + io_count;
    self.$slot_count = self.$s2p.$column_extent * self.$s2p.$row_extent;
    self.$permutation = new permutation.Permutation(self.$block_count,
                                                    self.$slot_count);
    self.$permutation.shuffle();
    self.$positions = self.$permutation.$node_slot_keys.map(
      function (slot_key, node_key) {
        return {key: node_key, slot_key: slot_key,
                position: self.$s2p.get(slot_key)};
    });
    self.$dependent_groups = {};
    self.$new_positions = [];
    self.$grid.update_nodes(self.$positions, {enlarge_to_moved: false,
                                              duration: 0}).each(
      'end', function (d, i) {
        if (i == self.$positions.length - 1) {
          self.$grid.$dsvg.zoom_to_fit();
        } });
    self.random_displacements = function (max_magnitude) {
      var _max_magnitude = self.$s2p.$row_extent - 1;
      var max_magnitude = ((typeof max_magnitude == 'undefined')
                           ? {row: _max_magnitude, column: _max_magnitude}
                           : max_magnitude);
      max_magnitude.row = Math.min(_max_magnitude, max_magnitude.row);
      max_magnitude.column = Math.min(_max_magnitude, max_magnitude.column);
      self.$grid.$grid.clear();
      var extent_2d = {row: self.$s2p.$row_extent,
                       column: self.$s2p.$row_extent};
      return self.$permutation.random_displacements(max_magnitude, self.$s2p);
    }
    self.propose_displacements = function (d) {
      self.$d = (typeof d == 'undefined') ? self.random_displacements() : d;
      self.$grid.$grid.select_none();
      var nodes = self.$grid.$grid.$svg.selectAll('.node_group').data();
      self.$new_nodes = nodes.map(function (node) {
        return {node: node,
                slot_key: clipped_slot_key(node.slot_key,
                                           self.$d.get(node.slot_key))};
      });
      self.$new_positions = self.$new_nodes.map(function (node) {
        return {key: node.node.key,
                slot_key: node.slot_key,
                position: self.$s2p.get(node.slot_key)};
      });
      self.$grid.$grid.moved_edges(self.$new_positions);
      self.$grid.$grid.$svg.selectAll('.node_group').each(function (d) {
        var new_slot_key = clipped_slot_key(d.slot_key,
                                            self.$d.get(d.slot_key));
        if (new_slot_key != d.slot_key) {
          d3.select(this).classed('selected', true);
        }
      });

      self.$dependent_groups = {};
      self.$permutation.$node_slot_keys.map(
        function (slot_key, node_key) {
          var d = self.$d.get(slot_key);
          var group_key = null;
          if (d > 0) {
            group_key = slot_key;
          } else if (d < 0) {
            group_key = slot_key + d;
          }
          if (group_key != null) {
            if (!(group_key in self.$dependent_groups)) {
              self.$dependent_groups[group_key] = {};
            }
            self.$dependent_groups[group_key][node_key] = null;
          } });
    };

    self.apply_displacements = function () {
      var temp = self.$grid.$grid.$svg.selectAll('.node_group').data();
      self.$grid.update_nodes(self.$new_positions, {resize: false});
      self.$new_positions = temp;
      self.$grid.$grid.$svg.selectAll('.node_group').data().map(function (d) {
        self.$permutation.$node_slot_keys[d.key] = d.slot_key; })
      for (var i = 0; i < self.$permutation.$slot_node_keys.length; i++) {
        self.$permutation.$slot_node_keys[i] = self.$block_count;
      }
      self.$permutation.$node_slot_keys.map(function (slot_key, node_key) {
        self.$permutation.$slot_node_keys[slot_key] = node_key; });
    };
  };

  return plugin_context;
});
