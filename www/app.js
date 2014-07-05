// For any third party dependencies, like jQuery, place them in the lib folder.

// Configure loading modules from the lib directory,
// except for 'app' ones, which are in a sibling
// directory.
requirejs.config({
    baseUrl: 'lib',
    paths: {
        app: '../app',
        jquery: 'jquery-2.1.1.min',
        d3: 'd3.v3.min',
        d3_context: 'd3-context',
        dynamic_svg: 'dynamic-svg',
        grid: 'grid',
        dynamic_grid: 'dynamic-grid',
        permutation: 'permutation',
        placement: 'placement',
        dependent_moves_placer: 'dependent-moves-placer',
        "jquery.bootstrap": "lib/bootstrap-3.1.1-dist/js/bootstrap.min",
        "numeric": "numeric-1.2.6",
        sparse_matrix: 'sparse-matrix'
        //"jquery.bootstrap": "//netdna.bootstrapcdn.com/bootstrap/3.1.1/js/bootstrap.min"
    },
    shim: {
        "jquery.bootstrap": {deps: ["jquery"]},
        "numeric": {deps: ['jquery']},
        "sparse_matrix": {deps: ['numeric']}
    }
});

// Start loading the main app file. Put all of
// your application logic in there.
requirejs(['app/main']);
