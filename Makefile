.SILENT :

beatbox:
	echo "#############################################"
	echo "BeatBox: Installing npm modules..."
	echo "#############################################"
	npm install
	echo "#############################################"
	echo "BeatBox: Installing bower components..."
	echo "#############################################"
	bower install --allow-root
	echo "#############################################"
	echo "BeatBox: Building assets..."
	echo "#############################################"
	gulp
