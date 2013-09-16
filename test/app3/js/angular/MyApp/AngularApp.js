var app = angular.module('angularApp', []).
  config(function($routeProvider) {
    $routeProvider.
      when('/', {controller:AngularCtrl, templateUrl:'js/angular/PhotoList/template1.html'}).
      when('/new', {controller:CreateCtrl, templateUrl:'js/angular/PhotoList/template2.html'}).
      otherwise({redirectTo:'/'});
  });

function AngularCtrl($scope) {
}

function CreateCtrl($scope, $location, $timeout, angularService) {
}
