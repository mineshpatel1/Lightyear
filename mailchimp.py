#! /usr/bin/env python
# MailChimp integration

import lyf

from dateutil.parser import parse	# Date parser

def main():
	
	for list in lyf.get_mc_lists():
		print(list.name, list.last_subscriber)
	
	
	#url += '/fa9410f164/members'
	#r = requests.get(url, auth=(user, api_key))
	#r.raise_for_status()
	#results = r.json()
	
	#for subscriber in results['members']:
		#print(subscriber['email_address'])
	
	
if __name__ == '__main__':
	main()
