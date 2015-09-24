;(function($) {

	'use strict';

	/**
	* 
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var addRemoteQRCode = function() {
		var url = window.location.href,
			arr = url.split('/'),
			remoteUrl = arr[0]+'//'+arr[2]+'/remote.html',
			qrSrc = 'https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl='+encodeURIComponent(remoteUrl),
			$qrBox = $('#qr-code');

			console.log(remoteUrl);
		
		$qrBox.append('<img src="'+qrSrc+'"><br><a href="'+remoteUrl+'">'+remoteUrl+'</a>');
	};


	/**
	* 
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var init = function() {
		addRemoteQRCode();
	};

	$(document).ready(init);

})(jQuery);