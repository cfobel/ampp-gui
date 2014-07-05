define(function (require) {
  var $ = require('jquery');
  var d3 = require('d3');

  var plugin_context = {};

  function repeat(array, n) {
    return d3.range(n).map(function () { return array; })
                      .reduce(function (a, b) {
                        return a.concat(b);
                      });
  }

  function iarray(array) {
    var self = this;

    self.$array = array;
    self.$count = array.length;

    self.get = function (i) { return self.$array[i]; }
    self.size = function () { return self.$count; }
  }

  function irepeat(iterator, repeat_count, size) {
    var self = this;

    self.$iterator = iterator;
    self.$sequence_count = iterator.size();
    self.$count = self.$sequence_count * repeat_count;
    self.$size = (typeof size == "undefined") ? self.$count : size;
    self.$repeat_count = repeat_count;

    self.get = function (i) {
      var index = Math.floor(i / repeat_count) % self.$sequence_count;
      return self.$iterator.get(index);
    }
    self.size = function () { return self.$size; }
  }

  function itile(iterator, tile_count, size) {
    var self = this;

    self.$iterator = iterator;
    self.$sequence_count = iterator.size();
    self.$count = self.$sequence_count * tile_count;
    self.$size = (typeof size == "undefined") ? self.$count : size;
    self.$tile_count = tile_count;

    self.get = function (i) {
      return self.$iterator.get(i % self.$sequence_count);
    }
    self.size = function () { return self.$size; }
  }

  function idisplacement_pattern(magnitude, shift) {
    var self = this;

    self.$magnitude = magnitude;
    self.$2d = 2 * magnitude;
    self.$shift = (typeof shift == "undefined") ? 0 : shift;

    self.get = function (i) {
      var index = i + 2 * self.$2d - ((self.$shift + self.$magnitude + 1) %
                                      self.$2d);
      if ((index % self.$2d) < self.$magnitude) {
        return self.$magnitude;
      } else {
        return -self.$magnitude;
      }
    }
    self.size = function () { return self.$iterator.size(); }
  }

  function i2d_displacement_pattern(magnitude, shift, extent) {
    var self = this;

    self.$iterators = {row: new idisplacement_pattern(magnitude.row,
                                                      shift.row),
                       column: new idisplacement_pattern(magnitude.column,
                                                         shift.column)};
    self.$extent = extent;
    self.$size = extent.row * extent.column;

    self.column_i = function (i) {
      return (Math.floor(i / self.$extent.row)
              + self.$extent.column * (i % self.$extent.row));
    }
    self.get = function (i) {
      return {column: self.$iterators.column.get(self.column_i(i)),
              row: self.$iterators.row.get(i)};
    }
    self.size = function () { return self.$size; }
  }

  function i2d_displacement_pattern_flat(magnitude, shift, extent) {
    var self = this;

    self.$iterator = new i2d_displacement_pattern(magnitude, shift, extent);

    self.get = function (i) {
      var displacement_2d = self.$iterator.get(i);
      return (displacement_2d.column * self.$iterator.$extent.row +
              displacement_2d.row);
    }
    self.size = function () { return self.$iterator.size(); }
  }

  function i2d_displacement_pattern_inbounds(magnitude, shift,
                                             s2p) {
    //console.log([i2d_displacement_pattern_inbounds, s2p]);
    var self = this;

    self.$s2p = s2p;
    self.$iterator = new i2d_displacement_pattern(magnitude, shift,
                                                  {row: self.$s2p.$row_extent,
                                                   column: self.$s2p
                                                   .$column_extent});
    self.$iterators = self.$iterator.$iterators;

    self.get = function (i, verbose) {
      var verbose = (typeof verbose == "undefined") ? false : verbose;
      /* Get zero-based position, since displacement patterns are indexed
       * starting at zero. */
      var position0 = self.$s2p.get0(i);
      /* We still need to use the offset-based position for computing the
       * target position. */
      var position = self.$s2p.get(i);
      var d = {column: self.$iterators.column.get(position0.x),
               row: self.$iterators.row.get(position0.y)};
      var target = {x: position.x + d.column, y: position.y + d.row};
      if (!self.$s2p.in_bounds(target)) {
        /* If the displacement targets a location that is outside the
         * boundaries, set displacement to zero. */
        if (verbose) {
          console.log(['out-of-bounds', position, d, target].map(function (d, i) {
            return JSON.stringify(d);
          }));
        }
        return 0;
      }
      return (d.column * self.$iterator.$extent.row + d.row);
    }
    self.size = function () { return self.$iterator.size(); }
  }

  function tile(array, n) {
    return array.map(function (v) {
                      return d3.range(n).map(function () { return v; });
                     })
                .reduce(function (a, b) { return a.concat(b); });
  }

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

  function slot_key_to_position(row_extent, offset) {
    var self = this;

    self.$offset = (typeof offset == "undefined") ? {x: 0, y: 0} : offset;
    self.$row_extent = row_extent;

    self.get = function (k) {
      var p = {x: Math.floor(k / self.$row_extent), y: (k % self.$row_extent)};
      return {x: p.x + self.$offset.x, y: p.y + self.$offset.y};
    }
  }

  function vpr_io_slot_key_to_position(extent, io_capacity) {
    var self = this;

    self.$extent = $.extend({}, extent);
    self.$io_capacity = io_capacity;

    var io_count = {row: self.$extent.row * self.$io_capacity,
                    column: self.$extent.column * self.$io_capacity};
    self.$segment_start = {bottom: 0,
                           right: io_count.row};
    self.$segment_start.top = self.$segment_start.right + io_count.column;
    self.$segment_start.left = self.$segment_start.top + io_count.row;
    self.$size = 2 * (io_count.column + io_count.row);

    self.size = function () { return self.$size; }

    self.get = function (k) {
      if (k < self.$segment_start.right) {
        /* Slot `k` maps to position along the bottom of the grid. */
        return {x: 0, y: 1 + Math.floor(k / self.$io_capacity)};
      } else if (k < self.$segment_start.top) {
        /* Slot `k` maps to position along the right side of the grid. */
        return {x: 1 + Math.floor((k - self.$segment_start.right) /
                                  self.$io_capacity),
                y: self.$extent.row + 1};
      } else if (k < self.$segment_start.left) {
        /* Slot `k` maps to position along the top of the grid. */
        return {x: self.$extent.column + 1,
                y: (self.$extent.row -
                    Math.floor((k - self.$segment_start.top) /
                               self.$io_capacity))};
      } else {
        /* Assume slot `k` maps to position along the left of the grid. */
        return {x: (self.$extent.column -
                    Math.floor((k - self.$segment_start.left) /
                               self.$io_capacity)),
                y: 0};
      }
    }
  }

  function vpr_auto_slot_key_to_position(io_count, logic_count, io_capacity) {
    var self = this;
    self.$io_capacity = (typeof io_capacity == "undefined") ? 2 : io_capacity;
    self.$io_count = io_count;
    self.$logic_count = logic_count;
    self.$row_extent = Math.ceil(Math.sqrt(logic_count));
    self.$column_extent = self.$row_extent;
    if (2 * (self.$row_extent + self.$column_extent) * self.$io_capacity <
        io_count) {
      self.$row_extent = Math.ceil(Math.sqrt(io_count + logic_count));
      self.$column_extent = self.$row_extent;
    }

    var io_extent;
    if (io_count > 0) {
      io_extent = {row: self.$row_extent, column: self.$column_extent};
    } else {
      io_extent = {row: 0, column: 0};
    }

    self.$io_s2p = new vpr_io_slot_key_to_position(io_extent,
                                                   self.$io_capacity);
    self.$logic_s2p = new slot_key_to_position(self.$row_extent, {x: 1, y: 1});
    self.$slot_count = {io: self.$io_s2p.size(), logic: (self.$row_extent *
                                                         self.$column_extent)};

    self.in_bounds = function (position) {
      var p = {x: position.x - self.$logic_s2p.$offset.x,
               y: position.y - self.$logic_s2p.$offset.y};
      return !(p.x < 0 || p.x >= self.$column_extent ||
               p.y < 0 || p.y >= self.$row_extent);
    }

    self.get0 = function (k) {
      var position = self.get(k);
      return {x: position.x - self.$logic_s2p.$offset.x,
              y: position.y - self.$logic_s2p.$offset.y};
    }

    self.get = function (k) {
      if (k < self.$io_s2p.size()) {
        return self.$io_s2p.get(k);
      } else {
        return self.$logic_s2p.get(k - self.$io_s2p.size());
      }
    }
  }

  plugin_context.Permutation = function (node_count, slot_count) {
    var self = this;
    self.$node_count = node_count;
    self.$slot_count = slot_count;
    self.$node_slot_keys = d3.range(node_count);
    self.$slot_node_keys = d3.range(node_count).concat(d3.range(slot_count -
                                                                node_count)
                                                       .map(function () {
                                                         return node_count;
                                                       }));

    self.shuffle = function () {
      shuffle(self.$slot_node_keys);
      self.$slot_node_keys.map(function (node_key, slot_key) {
        if (node_key < self.$node_slot_keys.length) {
          self.$node_slot_keys[node_key] = slot_key;
        }
      });
    }

    self.random_displacements = function (max_magnitude, vpr_s2p) {
      var max_magnitude = (typeof max_magnitude == "undefined")
                           ? {} : max_magnitude;
      max_magnitude.row = (('row' in max_magnitude) ? max_magnitude.row
                                                    : self.$slot_count - 1);
      max_magnitude.column = (('column' in max_magnitude)
                              ? max_magnitude.column : self.$slot_count - 1);

      var magnitude = {row: randint(0, max_magnitude.row),
                       column: randint(0, max_magnitude.column)};

      while (magnitude.row == 0 && magnitude.column == 0) {
        magnitude.row = randint(Math.min(vpr_s2p.$row_extent - 1,
                                         max_magnitude.row));
        magnitude.column = randint(Math.min(vpr_s2p.$column_extent - 1,
                                            max_magnitude.column));
      }

      var shift = {row: 0, column: 0};

      if (magnitude.row > 0) {
        var max_shift = 2 * magnitude.row - 1;
        if (vpr_s2p.$row_extent <= 2 * magnitude.row) {
          //max_shift = magnitude.row - 1;
          max_shift = vpr_s2p.$row_extent - 2;
        }
        shift.row = randint(max_shift);
      }
      if (magnitude.column > 0) {
        var max_shift = 2 * magnitude.column - 1;
        if (vpr_s2p.$column_extent <= 2 * magnitude.column) {
          //max_shift = magnitude.column - 1;
          max_shift = vpr_s2p.$column_extent - 2;
        }
        shift.column = randint(max_shift);
      }
      return self.displacements(magnitude, shift, vpr_s2p);
    }

    self.displacements = function (magnitude, shift, vpr_s2p) {
      var displacements = new i2d_displacement_pattern_inbounds(magnitude,
                                                                shift,
                                                                vpr_s2p);
      console.log([displacements.$iterators.row.$magnitude,
                   displacements.$iterators.row.$shift,
                   d3.range(vpr_s2p.$row_extent).map(function (i) {
                     return displacements.$iterators.row.get(i);
                   })]);
      console.log([displacements.$iterators.column.$magnitude,
                   displacements.$iterators.column.$shift,
                   d3.range(vpr_s2p.$column_extent).map(function (i) {
                     return displacements.$iterators.column.get(i);
                   })]);
      return displacements;
    }
  }

  plugin_context.shuffle = shuffle;
  plugin_context.randint = randint;
  plugin_context.choice = choice;
  plugin_context.repeat = repeat;
  plugin_context.tile = tile;
  plugin_context.iarray = iarray;
  plugin_context.irepeat = irepeat;
  plugin_context.itile = itile;
  plugin_context.idisplacement_pattern = idisplacement_pattern;
  plugin_context.i2d_displacement_pattern = i2d_displacement_pattern;
  plugin_context.i2d_displacement_pattern_flat = i2d_displacement_pattern_flat;
  plugin_context.i2d_displacement_pattern_inbounds = i2d_displacement_pattern_inbounds;
  plugin_context.slot_key_to_position = slot_key_to_position;
  plugin_context.vpr_auto_slot_key_to_position = vpr_auto_slot_key_to_position;
  plugin_context.vpr_io_slot_key_to_position = vpr_io_slot_key_to_position;
  return plugin_context;
});
