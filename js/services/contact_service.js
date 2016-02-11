var contacts;
app.service('ContactService', [ 'DavClient', 'AddressBookService', 'Contact', '$q', 'CacheFactory', 'uuid4', function(DavClient, AddressBookService, Contact, $q, CacheFactory, uuid4) {

	contacts = CacheFactory('contacts');

	var observerCallbacks = [];

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function() {
		angular.forEach(observerCallbacks, function(callback){
			callback(contacts.values());
		});
	};

	this.fillCache = function() {
		return AddressBookService.getEnabled().then(function(enabledAddressBooks) {
			var promises = [];
			enabledAddressBooks.forEach(function(addressBook) {
				promises.push(
					AddressBookService.sync(addressBook).then(function(addressBook) {
						for(var i in addressBook.objects) {
							contact = new Contact(addressBook.objects[i]);
							contacts.put(contact.uid(), contact);
						}
					})
				);
			});
			return $q.all(promises);
		});
	};

	this.getAll = function() {
		return this.fillCache().then(function() {
			return contacts.values();
		});
	};

	this.getById = function(uid) {
		return contacts.get(uid);
	};

	this.create = function(newContact, addressBook) {
		newContact = newContact || new Contact();
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();
		var newUid = uuid4.generate();
		newContact.uid(newUid);
		newContact.setUrl(addressBook, newUid);

		return DavClient.createCard(
			addressBook,
			{
				data: newContact.data.addressData,
				filename: newUid + '.vcf'
			}
		).then(function(xhr) {
			newContact.setETag(xhr.getResponseHeader('ETag'));
			contacts.put(newUid, newContact);
			notifyObservers();
			return newContact;
		}).catch(function(e) {
			console.log("Couldn't create", e);
		});
	};

	this.update = function(contact) {
		// update contact on server
		return DavClient.updateCard(contact.data, {json: true}).then(function(xhr){
			var newEtag = xhr.getResponseHeader('ETag');
			contact.setETag(newEtag);
		});
	};

	this.delete = function(contact) {
		// delete contact from server
		return DavClient.deleteCard(contact.data).then(function(xhr) {
			contacts.remove(contact.uid());
			notifyObservers();
		});
	};
}]);
